"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ArchiveRestore,
  Calendar,
  Check,
  CheckCheck,
  Copy,
  Filter,
  Loader2,
  Moon,
  Settings,
  Sun,
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
   const [isDark, setIsDark] = useState(false);

  // --- Theme ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    setIsDark(!!prefersDark);
  }, []);

  const toggleTheme = () => setIsDark((prev) => !prev);

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
    <div
      className={`min-h-screen font-sans ${
        isDark ? "bg-[#0f0f0f] text-[#ededed]" : "bg-white text-gray-900"
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
              Curator{" "}
              <span className={isDark ? "text-blue-400" : "text-blue-600"}>
                SportBiz
              </span>
            </h1>
            <div className="mt-2 flex items-center gap-3 text-xs font-medium">
              <button
                onClick={() => setViewMode("unread")}
                className={`border-b-2 pb-1 transition-colors ${
                  viewMode === "unread"
                    ? isDark
                      ? "border-blue-500 text-blue-400"
                      : "border-blue-600 text-blue-600"
                    : isDark
                    ? "border-transparent text-gray-500 hover:text-gray-300"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                À traiter ({viewMode === "unread" ? articles.length : "..."})
              </button>
              <button
                onClick={() => setViewMode("archived")}
                className={`border-b-2 pb-1 transition-colors ${
                  viewMode === "archived"
                    ? isDark
                      ? "border-blue-500 text-blue-400"
                      : "border-blue-600 text-blue-600"
                    : isDark
                    ? "border-transparent text-gray-500 hover:text-gray-300"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                Archives
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs transition-colors ${
                isDark
                  ? "border-[#262626] bg-[#161616] text-gray-300 hover:bg-[#1f1f1f]"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}
              aria-label="Basculer le thème"
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
            <Link
              href={`/admin?secret=${process.env.NEXT_PUBLIC_ADMIN_SECRET || ""}`}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                isDark
                  ? "border-[#262626] text-gray-300 hover:bg-[#161616]"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Settings size={14} />
              Admin
            </Link>
          </div>
        </header>

        {/* Toolbar */}
        <div
          className={`flex flex-wrap items-end justify-between gap-4 rounded-lg border px-4 py-3 text-xs ${
            isDark
              ? "border-[#262626] bg-[#161616]"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-medium text-gray-500">
                <span>Score {minScore}+</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className={`h-1.5 w-32 cursor-pointer appearance-none rounded-full ${
                  isDark ? "bg-[#262626] accent-blue-500" : "bg-gray-200 accent-blue-600"
                }`}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
                <Filter size={10} />
                <span>Catégorie</span>
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`h-8 rounded-md border px-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 ${
                  isDark
                    ? "border-[#262626] bg-[#161616] text-gray-200"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                <option value="All">Toutes</option>
                {VALID_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-medium text-gray-500">Tri</div>
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "created_at" | "relevance_score")
                  }
                  className={`h-8 rounded-md border px-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 ${
                    isDark
                      ? "border-[#262626] bg-[#161616] text-gray-200"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  <option value="created_at">Date</option>
                  <option value="relevance_score">Score</option>
                </select>
                <select
                  value={sortDir}
                  onChange={(e) =>
                    setSortDir(e.target.value as "desc" | "asc")
                  }
                  className={`h-8 rounded-md border px-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 ${
                    isDark
                      ? "border-[#262626] bg-[#161616] text-gray-200"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  <option value="desc">↓ Desc</option>
                  <option value="asc">↑ Asc</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyForBeehiiv}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                isCopying
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : isDark
                  ? "border-blue-500 bg-blue-500 text-white hover:bg-blue-600"
                  : "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isCopying ? <Check size={14} /> : <Copy size={14} />}
              {selectedIds.size > 0
                ? `Copier (${selectedIds.size})`
                : "Copier tout"}
            </button>
            <button
              onClick={() =>
                toggleReadStatus(
                  selectedIds.size > 0
                    ? Array.from(selectedIds)
                    : filteredArticles.map((a) => a.id)
                )
              }
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                viewMode === "unread"
                  ? isDark
                    ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
                    : "border-red-500/30 text-red-600 hover:bg-red-500/5"
                  : isDark
                  ? "border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                  : "border-blue-500/30 text-blue-600 hover:bg-blue-500/5"
              }`}
            >
              {viewMode === "unread" ? (
                <CheckCheck size={14} />
              ) : (
                <ArchiveRestore size={14} />
              )}
              {viewMode === "unread"
                ? selectedIds.size > 0
                  ? `Archiver (${selectedIds.size})`
                  : "Tout archiver"
                : selectedIds.size > 0
                ? `Restaurer (${selectedIds.size})`
                : "Tout restaurer"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className={`overflow-hidden rounded-lg border ${
            isDark ? "border-[#262626] bg-[#0f0f0f]" : "border-gray-200 bg-white"
          }`}
        >
          {isLoading ? (
            <div className="flex justify-center py-16 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr
                    className={`text-[11px] font-semibold uppercase tracking-wide ${
                      isDark
                        ? "border-b border-[#262626] bg-[#161616] text-gray-400"
                        : "border-b border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    <th className="px-4 py-2.5 w-8">
                      <input
                        type="checkbox"
                        onChange={toggleSelectAll}
                        checked={
                          selectedIds.size > 0 &&
                          selectedIds.size === filteredArticles.length
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                    </th>
                    <th className="px-4 py-2.5 w-[35%] text-xs font-semibold">
                      Article
                    </th>
                    <th className="px-4 py-2.5 w-24 text-center text-xs font-semibold">
                      Score
                    </th>
                    <th className="px-4 py-2.5 w-48 text-xs font-semibold">
                      Catégorie
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold">
                      Beehiiv
                    </th>
                    <th className="px-4 py-2.5 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filteredArticles.map((article, index) => {
                    const isSelected = selectedIds.has(article.id);
                    const showDateHeader =
                      index === 0 ||
                      new Date(
                        filteredArticles[index - 1].created_at
                      ).toDateString() !==
                        new Date(article.created_at).toDateString();

                    const score = article.relevance_score;
                    const scoreClass =
                      score !== null && score >= 8
                        ? isDark
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-emerald-100 text-emerald-700"
                        : score !== null && score >= 5
                        ? isDark
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-amber-100 text-amber-700"
                        : isDark
                        ? "bg-[#161616] text-gray-500"
                        : "bg-gray-100 text-gray-500";

                    return (
                      <tr
                        key={article.id}
                        className={`group text-sm ${
                          isDark
                            ? "border-b border-[#262626] last:border-b-0 hover:bg-[#161616]"
                            : "border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                        } ${
                          isSelected
                            ? isDark
                              ? "bg-[#161616]"
                              : "bg-blue-50"
                            : ""
                        }`}
                      >
                        <td className="px-4 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(article.id)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          {showDateHeader && (
                            <div className="mb-2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDateTitle(article.created_at)}</span>
                            </div>
                          )}
                          <a
                            href={article.url}
                            target="_blank"
                            className={`block text-sm font-medium leading-snug ${
                              isDark
                                ? "text-[#ededed] hover:text-blue-400"
                                : "text-gray-900 hover:text-blue-600"
                            } underline-offset-4 hover:underline`}
                          >
                            {article.title}
                          </a>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                            <span>
                              {article.source || getDomain(article.url)}
                            </span>
                            {article.access_status === "paywall" && (
                              <span className="text-[10px] font-semibold text-amber-500">
                                PAYWALL
                              </span>
                            )}
                            <span>
                              •{" "}
                              {new Date(
                                article.created_at
                              ).toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {article.summary && (
                            <p className="mt-1 line-clamp-2 text-[11px] italic text-gray-400">
                              "{article.summary}"
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center align-top">
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${scoreClass}`}
                          >
                            {article.relevance_score}/10
                          </span>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <select
                            value={article.category || ""}
                            onChange={(e) =>
                              updateCategory(article.id, e.target.value)
                            }
                            className={`w-full rounded-md border px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 ${
                              isDark
                                ? "border-[#262626] bg-[#161616] text-gray-200"
                                : "border-gray-200 bg-white text-gray-700"
                            }`}
                          >
                            <option value="" disabled>
                              -
                            </option>
                            {VALID_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3 align-top">
                          <div
                            className={`max-w-xs truncate rounded-md border px-2 py-1 text-[11px] font-mono ${
                              isDark
                                ? "border-[#262626] bg-[#0f0f0f] text-gray-400"
                                : "border-gray-200 bg-gray-50 text-gray-500"
                            }`}
                          >
                            {article.title} - [
                            {article.source || getDomain(article.url)}](
                            {article.url}) {getEmoji(article.access_status)}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right align-top">
                          <button
                            onClick={() => toggleReadStatus([article.id])}
                            className={`rounded-md p-1.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 ${
                              viewMode === "unread"
                                ? isDark
                                  ? "text-gray-400 hover:text-emerald-400"
                                  : "text-gray-400 hover:text-emerald-600"
                                : isDark
                                ? "text-blue-400 hover:text-blue-300"
                                : "text-blue-500 hover:text-blue-600"
                            }`}
                            title={
                              viewMode === "unread" ? "Archiver" : "Restaurer"
                            }
                          >
                            {viewMode === "unread" ? (
                              <Check size={16} />
                            ) : (
                              <ArchiveRestore size={16} />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredArticles.length === 0 && (
                <div className="py-16 text-center text-xs italic text-gray-400">
                  Aucun article dans cette section.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}