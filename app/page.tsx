"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Check, 
  Copy, 
  Settings, 
  Filter, 
  Loader2,
  Calendar,
  CheckCheck,
  ArchiveRestore
} from "lucide-react";
import Link from "next/link";

// --- Configuration ---
const VALID_CATEGORIES = [
  'Activation', 'Alpes 2030', 'Ambush', 'Athlétisme', 'Aviron', 'Badminton', 
  'Basketball', 'Boxe', 'Branding', 'Campagne', 'Catch', 'Chiffre', 'Cyclisme', 
  'Emploi', 'Equitation', 'Escalade', 'Escrime', 'eSport', 'Fitness', 'Football', 
  'Football US', 'Golf', 'Gymnastique', 'Handball', 'Hippisme', 'Hockey-sur-Glace', 
  'Hommes & Femmes', 'Insolite', 'Institutions', 'International', 'Judo', 'Karate', 
  'LA28', 'Marques & Entreprises', 'Médias', 'Merchandising', 'Milan Cortina 2026', 
  'MMA', 'Natation', 'Paris 2024', 'Patinage artistique', 'Podcast', 'RSE', 'Rugby', 
  'Ski', 'Sponsoring', 'Sports de combat', 'Sports de glisse', 'Sports mécaniques', 
  'Stades & Arenas', 'Sumo', 'Tennis / Padel', 'Tennis de table', 'Tir', 
  'Tous les sports', 'Trail', 'Triathlon', 'Vidéo', 'Voile', 'Volleyball'
].sort();

// --- Types ---
type Article = {
  id: number;
  title: string;
  url: string;
  category: string | null;
  relevance_score: number | null;
  access_status: string | null;
  summary: string | null;
  created_at: string;
  source: string | null;
  is_read: boolean;
};

// --- Supabase ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [minScore, setMinScore] = useState(5);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"created_at" | "relevance_score">("created_at");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isCopying, setIsCopying] = useState(false);
  const [viewMode, setViewMode] = useState<"unread" | "archived">("unread");

  // --- Data Fetching ---
  const fetchArticles = async () => {
    setIsLoading(true);
    // Unread view: is_read === 0 (false). Archived: is_read === 1 (true).
    const isReadValue = viewMode === "archived" ? 1 : 0;

    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("is_read", isReadValue)
      .order("created_at", { ascending: false })
      .limit(viewMode === "archived" ? 100 : 1000); 
  
    if (!error && data) setArticles(data);
    setIsLoading(false);
    setSelectedIds(new Set()); // Reset selection au changement de vue
  };
  
  useEffect(() => { fetchArticles(); }, [viewMode]);

  // --- Logic Helpers ---
  const getDomain = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('www.', '');
    } catch { return 'lien'; }
  };

  const getEmoji = (status: string | null) => {
    if (status === 'paywall') return ' 💰';
    if (status === 'registration') return ' 📝';
    return '';
  };

  const formatDateTitle = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Aujourd'hui";
    if (date.toDateString() === yesterday.toDateString()) return "Hier";
    
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // --- Actions ---
  const updateCategory = async (id: number, newCategory: string) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, category: newCategory } : a));
    await supabase.from('articles').update({ category: newCategory }).eq('id', id);
  };

  const copyForBeehiiv = async () => {
    setIsCopying(true);
    const idsToProcess = selectedIds.size > 0 
      ? Array.from(selectedIds) 
      : filteredArticles.map(a => a.id);

    const articlesToCopy = articles.filter(a => idsToProcess.includes(a.id));
    
    const textContent = articlesToCopy
      .map(a => {
        const sourceName = a.source || getDomain(a.url);
        return `${a.title} - [${sourceName}](${a.url})${getEmoji(a.access_status)}`;
      })
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(textContent);
      setTimeout(() => setIsCopying(false), 1000);
    } catch (err) {
      setIsCopying(false);
    }
  };

  const toggleReadStatus = async (ids: number[]) => {
    if (ids.length === 0) return;
    
    const newStatus = viewMode === "unread"; // Si on est dans unread, on passe à read (true)
    const label = newStatus ? "archiver" : "restaurer";

    if (ids.length > 1 && !confirm(`Voulez-vous ${label} ${ids.length} article(s) ?`)) return;
    
    // UI Update
    setArticles(current => current.filter(a => !ids.includes(a.id)));
    setSelectedIds(new Set());
    
    // DB Update
    await supabase.from("articles").update({ is_read: newStatus }).in("id", ids);
  };

  // --- Filtering ---
  const filteredArticles = useMemo(() => {
    return articles
      .filter((article) => {
        const passesScore = article.relevance_score === null || article.relevance_score >= minScore;
        const passesCategory = selectedCategory === "All" || article.category === selectedCategory;
        return passesScore && passesCategory;
      })
      .sort((a, b) => {
        const aVal = sortBy === "relevance_score"
          ? (a.relevance_score ?? -1)
          : new Date(a.created_at).getTime();
        const bVal = sortBy === "relevance_score"
          ? (b.relevance_score ?? -1)
          : new Date(b.created_at).getTime();
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [articles, minScore, selectedCategory, sortBy, sortDir]);

  // --- Selection Logic ---
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredArticles.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredArticles.map(a => a.id)));
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Curator <span className="text-blue-500">SportBiz</span>
          </h1>
          <div className="flex gap-4 mt-2">
            <button 
              onClick={() => setViewMode("unread")}
              className={`text-sm font-medium transition-all pb-1 ${viewMode === "unread" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              À traiter ({viewMode === "unread" ? articles.length : '...'})
            </button>
            <button 
              onClick={() => setViewMode("archived")}
              className={`text-sm font-medium transition-all pb-1 ${viewMode === "archived" ? "text-blue-400 border-b-2 border-blue-400" : "text-gray-500 hover:text-gray-300"}`}
            >
              Archives
            </button>
          </div>
        </div>
        <Link href={`/admin?secret=${process.env.NEXT_PUBLIC_ADMIN_SECRET || ''}`} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm border border-gray-800 px-3 py-1.5 rounded-md hover:bg-gray-900 transition-colors">
          <Settings size={14} /> Admin
        </Link>
      </header>

      {/* Toolbar */}
      <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-800 mb-6 flex flex-wrap gap-6 items-end justify-between max-w-7xl mx-auto backdrop-blur-sm sticky top-2 z-10 shadow-xl">
        <div className="flex gap-6 items-center">
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-medium text-gray-400 uppercase">
              <span>Score {minScore}+</span>
            </div>
            <input type="range" min="0" max="10" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="w-32 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500" />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-400 uppercase flex gap-1 items-center"><Filter size={10}/> Filtre Catégorie</div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="bg-gray-800 text-sm text-white border border-gray-700 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none">
              <option value="All">Toutes</option>
              {VALID_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-400 uppercase">Sort by</div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "created_at" | "relevance_score")} className="bg-gray-800 text-sm text-white border border-gray-700 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none">
              <option value="created_at">Date</option>
              <option value="relevance_score">Score</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-400 uppercase">Order</div>
            <select value={sortDir} onChange={(e) => setSortDir(e.target.value as "desc" | "asc")} className="bg-gray-800 text-sm text-white border border-gray-700 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none">
              <option value="desc">↓ Desc</option>
              <option value="asc">↑ Asc</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={copyForBeehiiv} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-lg ${isCopying ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            {isCopying ? <Check size={16} /> : <Copy size={16} />}
            {selectedIds.size > 0 ? `Copier (${selectedIds.size})` : "Copier Tout"}
          </button>
          <button 
            onClick={() => toggleReadStatus(selectedIds.size > 0 ? Array.from(selectedIds) : filteredArticles.map(a => a.id))} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all border ${viewMode === 'unread' ? 'bg-red-900/20 hover:bg-red-900/40 text-red-400 border-red-900/30' : 'bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border-blue-900/30'}`}
          >
            {viewMode === 'unread' ? <CheckCheck size={16} /> : <ArchiveRestore size={16} />}
            {viewMode === 'unread' 
              ? (selectedIds.size > 0 ? `Archiver (${selectedIds.size})` : "Tout archiver")
              : (selectedIds.size > 0 ? `Restaurer (${selectedIds.size})` : "Tout restaurer")
            }
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="p-20 flex justify-center text-gray-500"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-950/50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-800">
                  <th className="p-4 w-10"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === filteredArticles.length} className="rounded border-gray-700 bg-gray-800 text-blue-600" /></th>
                  <th className="p-4 w-[35%]">Article</th>
                  <th className="p-4 w-32 text-center">Score</th>
                  <th className="p-4 w-48">Catégorie</th>
                  <th className="p-4">Beehiiv Link</th>
                  <th className="p-4 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredArticles.map((article, index) => {
                  const isSelected = selectedIds.has(article.id);
                  const showDateHeader = index === 0 || 
                    new Date(filteredArticles[index-1].created_at).toDateString() !== new Date(article.created_at).toDateString();
                  
                  return (
                    <tr key={article.id} className={`group hover:bg-gray-800/50 transition-colors ${isSelected ? 'bg-blue-900/10' : ''}`}>
                      <td className="p-4">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(article.id)} className="rounded border-gray-700 bg-gray-800 text-blue-600" />
                      </td>
                      <td className="p-4">
                        {showDateHeader && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3 bg-blue-500/5 py-1 px-2 rounded w-fit">
                            <Calendar size={10} /> {formatDateTitle(article.created_at)}
                          </div>
                        )}
                        <a href={article.url} target="_blank" className="font-medium text-gray-200 hover:text-blue-400 leading-snug block mb-1 underline-offset-4 hover:underline">
                          {article.title}
                        </a>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">{article.source || getDomain(article.url)}</span>
                          {article.access_status === 'paywall' && <span className="text-yellow-600 text-[10px] font-bold border border-yellow-900/50 px-1 rounded">PAYWALL</span>}
                          <span>• {new Date(article.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {article.summary && <p className="text-sm text-gray-400 mt-2 line-clamp-2 italic leading-relaxed">"{article.summary}"</p>}
                      </td>
                      
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${article.relevance_score && article.relevance_score >= 8 ? "bg-green-500/10 text-green-500" : "bg-gray-800 text-gray-400"}`}>
                          {article.relevance_score}/10
                        </span>
                      </td>

                      <td className="p-4">
                        <select 
                          value={article.category || ""} 
                          onChange={(e) => updateCategory(article.id, e.target.value)}
                          className="w-full bg-gray-950 text-xs text-gray-400 border border-gray-800 rounded p-1.5 outline-none focus:border-blue-500 transition-all"
                        >
                          <option value="" disabled>-</option>
                          {VALID_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </td>

                      <td className="p-4 font-mono text-[10px] text-gray-600 select-all">
                        <div className="bg-gray-950/50 p-2 rounded border border-gray-800 truncate max-w-[200px]">
                           {article.title} - [{article.source || getDomain(article.url)}]({article.url}) {getEmoji(article.access_status)}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                         <button 
                          onClick={() => toggleReadStatus([article.id])} 
                          className={`p-2 transition-all opacity-0 group-hover:opacity-100 rounded-md ${viewMode === 'unread' ? 'text-gray-700 hover:text-green-500 hover:bg-green-500/10' : 'text-blue-500 hover:text-blue-400 hover:bg-blue-500/10'}`}
                          title={viewMode === 'unread' ? "Archiver" : "Restaurer"}
                        >
                          {viewMode === 'unread' ? <Check size={18} /> : <ArchiveRestore size={18} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredArticles.length === 0 && (
              <div className="p-20 text-center text-gray-500 italic">Aucun article dans cette section.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}