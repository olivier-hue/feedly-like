"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Trash2, Plus, Save, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

// --- Supabase ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const secret = searchParams.get("secret");

  // --- States ---
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Données
  const [feeds, setFeeds] = useState<any[]>([]);
  const [blacklist, setBlacklist] = useState<any[]>([]);
  
  // Formulaires (C'est ici que newFeed manquait !)
  const [newFeed, setNewFeed] = useState({ name: "", url: "", category: "Général" });
  const [newKeyword, setNewKeyword] = useState("");

  // --- Auth & Chargement ---
  useEffect(() => {
    const expectedSecret = process.env.NEXT_PUBLIC_ADMIN_SECRET;
    
    // Petit délai pour laisser le temps au router de lire l'URL
    if (secret === expectedSecret) { 
        setIsAuthorized(true);
        fetchData();
    } else {
        // Optionnel : Redirection automatique après 2 secondes si échec
        // setTimeout(() => router.push("/"), 2000);
        setIsLoading(false);
    }
  }, [secret, router]);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: feedsData } = await supabase.from("feeds").select("*").order('created_at', { ascending: false });
    const { data: blacklistData } = await supabase.from("blacklist").select("*").order('created_at', { ascending: false });
    
    if (feedsData) setFeeds(feedsData);
    if (blacklistData) setBlacklist(blacklistData);
    setIsLoading(false);
  };

  // --- Actions Feeds ---
  const addFeed = async () => {
    if (!newFeed.name || !newFeed.url) return alert("Nom et URL requis");
    
    const { error } = await supabase.from("feeds").insert([{
      name: newFeed.name,
      url: newFeed.url,
      category: newFeed.category,
      active: true
    }]);

    if (!error) {
        setNewFeed({ name: "", url: "", category: "Général" });
        fetchData(); // Rafraîchir la liste
    } else {
        alert("Erreur : " + error.message);
    }
  };

  const deleteFeed = async (id: string) => {
    if(!confirm("Supprimer définitivement ce flux ?")) return;
    await supabase.from("feeds").delete().eq("id", id);
    setFeeds(feeds.filter(f => f.id !== id));
  };

  // --- Actions Blacklist ---
  const addKeyword = async () => {
    if (!newKeyword) return;
    const { error } = await supabase.from("blacklist").insert([{ keyword: newKeyword.toLowerCase() }]);
    
    if (!error) {
        setNewKeyword("");
        fetchData();
    } else {
        alert("Erreur (doublon ?) : " + error.message);
    }
  };

  const deleteKeyword = async (id: string) => {
    await supabase.from("blacklist").delete().eq("id", id);
    setBlacklist(blacklist.filter(b => b.id !== id));
  };

  // --- Affichage : Non Autorisé ---
  if (!isAuthorized && !isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-4">
            <div className="text-center max-w-md bg-gray-900 p-8 rounded-xl border border-red-900/50">
                <h1 className="text-3xl font-bold mb-4 text-red-500">Accès Refusé 🔒</h1>
                <p className="text-gray-400 mb-6">Le code secret est incorrect ou manquant.</p>
                <div className="bg-black/50 p-2 rounded text-xs font-mono text-gray-500 mb-6 break-all">
                  Reçu: {secret || "(vide)"}
                </div>
                <Link href="/" className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition-colors">
                  Retour au site
                </Link>
            </div>
        </div>
    );
  }

  // --- Affichage : Chargement ---
  if (isLoading && !isAuthorized) {
      return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-blue-500"><Loader2 className="animate-spin" size={40}/></div>;
  }

  // --- Affichage : Admin Panel ---
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans">
      <header className="max-w-5xl mx-auto mb-10 flex justify-between items-center border-b border-gray-800 pb-6">
        <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">⚙️ Back-Office</h1>
            <p className="text-gray-500 text-sm mt-1">Gérez vos sources et filtres</p>
        </div>
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors border border-gray-800">
            <ArrowLeft size={18} /> Retour Dashboard
        </Link>
      </header>

      <div className="max-w-5xl mx-auto grid gap-10">
        
        {/* SECTION FLUX RSS */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 shadow-xl">
            <h2 className="text-xl font-semibold mb-6 text-blue-400 flex items-center gap-2">
                📡 Mes Flux RSS <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">{feeds.length}</span>
            </h2>
            
            {/* Formulaire Ajout Flux */}
            <div className="flex flex-col md:flex-row gap-3 mb-8 bg-gray-900 p-4 rounded-lg border border-gray-700/50">
                <input 
                    placeholder="Nom (ex: L'Équipe)" 
                    className="bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-sm flex-1 focus:border-blue-500 outline-none" 
                    value={newFeed.name} 
                    onChange={e => setNewFeed({...newFeed, name: e.target.value})} 
                />
                <input 
                    placeholder="URL du Flux RSS" 
                    className="bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-sm flex-[2] focus:border-blue-500 outline-none" 
                    value={newFeed.url} 
                    onChange={e => setNewFeed({...newFeed, url: e.target.value})} 
                />
                <input 
                    placeholder="Catégorie" 
                    className="bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-sm w-full md:w-40 focus:border-blue-500 outline-none" 
                    value={newFeed.category} 
                    onChange={e => setNewFeed({...newFeed, category: e.target.value})} 
                />
                <button onClick={addFeed} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center">
                    <Plus size={20} />
                </button>
            </div>

            {/* Liste des Flux */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {feeds.map(feed => (
                    <div key={feed.id} className="flex justify-between items-center bg-gray-800 hover:bg-gray-750 p-4 rounded-lg border border-gray-700/50 transition-colors group">
                        <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-gray-200">{feed.name}</span>
                                <span className="text-xs bg-gray-900 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700">{feed.category}</span>
                            </div>
                            <div className="text-xs text-gray-500 truncate font-mono">{feed.url}</div>
                        </div>
                        <button 
                            onClick={() => deleteFeed(feed.id)} 
                            className="text-gray-600 hover:text-red-500 hover:bg-red-500/10 p-2 rounded transition-all opacity-0 group-hover:opacity-100"
                            title="Supprimer ce flux"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
            </div>
        </section>

        {/* SECTION BLACKLIST */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 shadow-xl">
            <h2 className="text-xl font-semibold mb-6 text-red-400 flex items-center gap-2">
                🚫 Mots-clés Interdits <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">{blacklist.length}</span>
            </h2>
            
            {/* Formulaire Ajout Mot-clé */}
            <div className="flex gap-3 mb-6 max-w-lg">
                <input 
                    placeholder="Mot à bannir (ex: pronostic, betting...)" 
                    className="bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-sm flex-1 focus:border-red-500 outline-none" 
                    value={newKeyword} 
                    onChange={e => setNewKeyword(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                />
                <button onClick={addKeyword} className="bg-red-900/80 hover:bg-red-600 text-white px-6 rounded-lg transition-colors flex items-center gap-2 font-medium">
                    <Save size={18} /> Ajouter
                </button>
            </div>

            {/* Liste des Mots-clés */}
            <div className="flex flex-wrap gap-2">
                {blacklist.map(item => (
                    <div key={item.id} className="group bg-gray-950 border border-gray-700 hover:border-red-500/50 text-gray-300 pl-3 pr-2 py-1.5 rounded-full text-sm flex items-center gap-2 transition-all">
                        {item.keyword}
                        <button 
                            onClick={() => deleteKeyword(item.id)} 
                            className="text-gray-600 hover:text-red-400 bg-gray-900 hover:bg-gray-800 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                        >
                            ×
                        </button>
                    </div>
                ))}
                {blacklist.length === 0 && <p className="text-gray-600 italic text-sm">Aucun mot-clé interdit pour le moment.</p>}
            </div>
        </section>

      </div>
    </div>
  );
}