"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function ShareForm() {
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url") ?? "";

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setUrl(urlParam);
  }, [urlParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
          secret: process.env.NEXT_PUBLIC_ADMIN_SECRET ?? "",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.error ?? "Erreur lors de l'enregistrement");
        return;
      }

      setStatus("success");
      setUrl("");
      setTitle("");
    } catch {
      setStatus("error");
      setErrorMessage("Erreur réseau");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      <div className="max-w-xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Enregistrer un article
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Collez un lien pour l’ajouter à votre curation. Optionnel : indiquez un titre.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
              Titre (optionnel)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'article"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {status === "success" && (
            <p className="text-green-500 font-medium">✅ Article sauvegardé !</p>
          )}
          {status === "error" && (
            <p className="text-red-400 text-sm">{errorMessage}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={status === "loading" || !url.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
            >
              {status === "loading" ? "Enregistrement…" : "Sauvegarder"}
            </button>
            <Link
              href="/"
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-6 py-2.5 rounded-lg font-medium transition-colors"
            >
              Retour
            </Link>
          </div>
        </form>

        <section className="mt-10 pt-8 border-t border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-2">Bookmarklet</h2>
          <p className="text-sm text-gray-400 mb-4">
            Pour partager en 1 clic depuis Safari, faites glisser ce bouton dans votre barre de favoris :
          </p>
          <a
            href="javascript:(function(){window.open('https://feedly-like.vercel.app/share?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'_blank')})();"
            draggable
            className="inline-block bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold px-5 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all cursor-grab active:cursor-grabbing select-none"
          >
            📌 Partager vers Feedly Like
          </a>
          <p className="text-xs text-gray-500 mt-4">
            Sur iOS : appuyez longuement sur ce bouton → Copier le lien → Créez un favori manuellement dans Safari et remplacez l&apos;URL par le lien copié.
          </p>
        </section>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">
          Chargement…
        </div>
      }
    >
      <ShareForm />
    </Suspense>
  );
}
