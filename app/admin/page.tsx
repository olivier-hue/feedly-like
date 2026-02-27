"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { Trash2, Plus, Save, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

// Forcer le mode dynamique pour éviter les erreurs de build
export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 1. On crée un composant interne qui utilise useSearchParams
function AdminContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const secret = searchParams.get("secret");

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feeds, setFeeds] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  const [newFeed, setNewFeed] = useState({ name: "", url: "", category: "Général" });
  const [newKeyword, setNewKeyword] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null);

  useEffect(() => {
    const expectedSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET;
    if (secret === expectedSecret) { 
        setIsAuthorized(true);
        fetchData();
    } else {
        setIsLoading(false);
    }
  }, [secret]);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: feedsData } = await supabase.from("feeds").select("*").order('created_at', { ascending: false });
    const { data: blacklistData } = await supabase.from("blacklist").select("*").order('created_at', { ascending: false });
    if (feedsData) setFeeds(feedsData);
    if (blacklistData) setBlacklist(blacklistData);
    setIsLoading(false);
  };

  const addFeed = async () => {
    if (!newFeed.name || !newFeed.url) return alert("Nom et URL requis");
    const { error } = await supabase.from("feeds").insert([{ ...newFeed, active: true }]);
    if (!error) { setNewFeed({ name: "", url: "", category: "Général" }); fetchData(); }
  };

  const deleteFeed = async (id: string) => {
    if(!confirm("Supprimer ?")) return;
    await supabase.from("feeds").delete().eq("id", id);
    setFeeds(feeds.filter(f => f.id !== id));
  };

  const addKeyword = async () => {
    if (!newKeyword) return;
    const { error } = await supabase.from("blacklist").insert([{ keyword: newKeyword.toLowerCase() }]);
    if (!error) { setNewKeyword(""); fetchData(); }
  };

  const deleteKeyword = async (id: string) => {
    await supabase.from("blacklist").delete().eq("id", id);
    setBlacklist(blacklist.filter(b => b.id !== id));
  };

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      const data = await res.json();
      setAnalyzeResult(`✅ ${data.analyzed} article(s) analysé(s)`);
    } catch {
      setAnalyzeResult("❌ Erreur lors de l'analyse");
    }
    setIsAnalyzing(false);
  };

  if (!isAuthorized && !isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
            <div className="text-center max-w-md bg-gray-900 p-8 rounded-xl border border-red-900/50">
                <h1 className="text-3xl font-bold mb-4 text-red-500">Accès Refusé 🔒</h1>
                <Link href="/" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors">Retour au site</Link>
            </div>
        </div>
    );
  }

  if (isLoading && !isAuthorized) {
      return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-blue-500"><Loader2 className="animate-spin" size={40}/></div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <header className="max-w-5xl mx-auto mb-10 flex justify-between items-center border-b border-gray-800 pb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">⚙️ Back-Office</h1>
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white bg-gray-900 px-4 py-2 rounded-lg border border-gray-800">
            <ArrowLeft size={18} /> Retour Dashboard
        </Link>
      </header>

      <div className="max-w-5xl mx-auto grid gap-10">
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
          <h2 className="text-xl font-semibold mb-4 text-purple-400">🤖 Analyse Gemini</h2>
          <p className="text-sm text-gray-400 mb-4">Lance l'analyse sur les 5 prochains articles non-analysés (6s entre chaque).</p>
          <div className="flex items-center gap-4">
            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all"
            >
              {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : null}
              {isAnalyzing ? 'Analyse en cours...' : '▶ Lancer analyse (5 articles)'}
            </button>
            {analyzeResult && <span className="text-sm text-gray-300">{analyzeResult}</span>}
          </div>
        </section>

        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
            <h2 className="text-xl font-semibold mb-6 text-red-400">🚫 Blacklist</h2>
            <div className="flex gap-3 mb-6">
                <input placeholder="Mot à bannir" className="bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-sm flex-1" value={newKeyword} onChange={e => setNewKeyword(e.target.value)} />
                <button onClick={addKeyword} className="bg-red-900 hover:bg-red-600 text-white px-6 rounded-lg flex items-center gap-2"><Save size={18} /> Ajouter</button>
            </div>
            <div className="flex flex-wrap gap-2">
                {blacklist.map(item => (
                    <div key={item.id} className="bg-gray-950 border border-gray-700 text-gray-300 pl-3 pr-2 py-1.5 rounded-full text-sm flex items-center gap-2">
                        {item.keyword}
                        <button onClick={() => deleteKeyword(item.id)} className="text-gray-600 hover:text-red-400">×</button>
                    </div>
                ))}
            </div>
        </section>

        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
            <h2 className="text-xl font-semibold mb-6 text-blue-400">📡 Mes Flux RSS</h2>
            <div className="flex flex-col md:flex-row gap-3 mb-8">
                <input placeholder="Nom" className="bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-sm flex-1" value={newFeed.name} onChange={e => setNewFeed({...newFeed, name: e.target.value})} />
                <input placeholder="URL" className="bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-sm flex-[2]" value={newFeed.url} onChange={e => setNewFeed({...newFeed, url: e.target.value})} />
                <button onClick={addFeed} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg"><Plus size={20} /></button>
            </div>
            <div className="space-y-3">
    {feeds.map(feed => (
        <div key={feed.id} className="bg-gray-800 p-4 rounded-lg group">
            <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                    <span className="font-bold text-blue-400">{feed.name}</span>
                    <span className="text-xs text-gray-500 font-mono break-all italic">
                        {feed.url}
                    </span>
                </div>
                <button 
                    onClick={() => deleteFeed(feed.id)} 
                    className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    ))}
</div>
        </section>
      </div>
    </div>
  );
}

// 2. Le composant principal qui entoure le tout de Suspense
export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-blue-500"><Loader2 className="animate-spin" size={40}/></div>}>
      <AdminContent />
    </Suspense>
  );
}