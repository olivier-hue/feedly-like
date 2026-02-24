"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { 
  Check, 
  Copy, 
  Settings, 
  Filter, 
  Loader2,
  ExternalLink
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isCopying, setIsCopying] = useState(false);

  // --- Data Fetching ---
  const fetchArticles = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    if (!error && data) setArticles(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchArticles(); }, []);

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
    return ''; // Free
  };

  // --- Actions ---

  // 1. Mise à jour de la catégorie (Base de données + UI)
  const updateCategory = async (id: number, newCategory: string) => {
    // Optimistic UI update
    setArticles(prev => prev.map(a => a.id === id ? { ...a, category: newCategory } : a));
    
    // DB Update
    await supabase.from('articles').update({ category: newCategory }).eq('id', id);
  };

  // 2. Copier format Beehiiv (Markdown)
  const copyForBeehiiv = async () => {
    setIsCopying(true);
    const idsToProcess = selectedIds.size > 0 
      ? Array.from(selectedIds) 
      : filteredArticles.map(a => a.id);

    const articlesToCopy = articles.filter(a => idsToProcess.includes(a.id));
    
    // Format : Titre - [Source](URL) 💰
    const textContent = articlesToCopy
      .map(a => {
        const sourceName = a.source || getDomain(a.url);
        return `${a.title} - [${sourceName}](${a.url})${getEmoji(a.access_status)}`;
      })
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(textContent);
      // Petit effet visuel pour confirmer
      setTimeout(() => setIsCopying(false), 1000);
    } catch (err) {
      console.error("Failed to copy", err);
      setIsCopying(false);
    }
  };

  // 3. Marquer comme lu 
  const markAsRead = async (ids: number[]) => {
    if (ids.length === 0) return;
    setArticles(current => current.filter(a => !ids.includes(a.id)));
    setSelectedIds(new Set());
    await supabase.from("articles").update({ is_read: true }).in("id", ids);
  };

  // --- Filtering ---
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      const passesScore = article.relevance_score === null || article.relevance_score >= minScore;
      const passesCategory = selectedCategory === "All" || article.category === selectedCategory;
      return passesScore && passesCategory;
    });
  }, [articles, minScore, selectedCategory]);

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
          <p className="text-gray-500 text-sm">{articles.length} articles en attente</p>
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
        </div>

        <div className="flex gap-3">
           <button onClick={copyForBeehiiv} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-lg ${isCopying ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            {isCopying ? <Check size={16} /> : <Copy size={16} />}
            {selectedIds.size > 0 ? `Copier (${selectedIds.size})` : "Copier Tout"}
          </button>
          <button onClick={() => markAsRead(selectedIds.size > 0 ? Array.from(selectedIds) : filteredArticles.map(a => a.id))} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-4 py-2 rounded-lg font-medium text-sm transition-all border border-gray-700">
            <Check size={16} /> Lu
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        {isLoading ? (
          <div className="p-20 flex justify-center text-gray-500"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-950/50 text-gray-500 text-xs uppercase font-semibold border-b border-gray-800">
                  <th className="p-4 w-10"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === filteredArticles.length} className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-offset-gray-900" /></th>
                  <th className="p-4 w-[35%]">Article</th>
                  <th className="p-4 w-32 text-center">Score</th>
                  <th className="p-4 w-48">Catégorie (Editable)</th>
                  <th className="p-4">Format Beehiiv (Aperçu)</th>
                  <th className="p-4 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredArticles.map((article) => {
                  const isSelected = selectedIds.has(article.id);
                  const domain = getDomain(article.url);
                  const emoji = getEmoji(article.access_status);
                  
                  return (
                    <tr key={article.id} className={`group hover:bg-gray-800/50 transition-colors ${isSelected ? 'bg-blue-900/10' : ''}`}>
                      <td className="p-4"><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(article.id)} className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-offset-gray-900" /></td>
                      <td className="p-4">
                        <a href={article.url} target="_blank" className="font-medium text-gray-200 hover:text-blue-400 leading-snug block mb-1">
                          {article.title}
                        </a>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">{article.source || domain}</span>
                          {article.access_status === 'paywall' && <span className="text-yellow-500 flex items-center gap-1">Paywall 💰</span>}
                          <span>• {new Date(article.created_at).toLocaleDateString()}</span>
                        </div>
                        {article.summary && <p className="text-sm text-gray-400 mt-2 line-clamp-2 leading-relaxed">{article.summary}</p>}
                      </td>
                      
                      <td className="p-4 text-center">
                        {article.relevance_score !== null ? (
                          <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold ${article.relevance_score >= 8 ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                            {article.relevance_score}/10
                          </span>
                        ) : <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded animate-pulse">Analysing...</span>}
                      </td>

                      {/* EDITABLE CATEGORY */}
                      <td className="p-4">
                        <select 
                          value={article.category || ""} 
                          onChange={(e) => updateCategory(article.id, e.target.value)}
                          className="w-full bg-gray-950 text-sm text-gray-300 border border-gray-700 rounded px-2 py-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all cursor-pointer hover:border-gray-600"
                        >
                          <option value="" disabled>-</option>
                          {VALID_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </td>

                      <td className="p-4 font-mono text-xs text-gray-500 select-all">
                        <div className="bg-gray-950/50 p-2 rounded border border-gray-800 truncate max-w-xs cursor-text hover:text-gray-300 transition-colors">
                           {article.title} - [{article.source || domain}]({article.url}) {emoji}
                        </div>
                      </td>

                      <td className="p-4 text-right">
                         <button onClick={() => markAsRead([article.id])} className="p-2 text-gray-600 hover:text-green-500 hover:bg-green-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100" title="Marquer comme lu">
                          <Check size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}