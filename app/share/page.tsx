"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const BOOKMARKLET_CODE =
  "javascript:(function(){window.open('https://feedly-like.vercel.app/share?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'_blank')})();";

const VALID_CATEGORIES = [
  "Activation", "Alpes 2030", "Ambush", "Athlétisme", "Aviron", "Badminton",
  "Basketball", "Boxe", "Branding", "Campagne", "Catch", "Chiffre", "Cyclisme",
  "Emploi", "Equitation", "Escalade", "Escrime", "eSport", "Fitness", "Football",
  "Football US", "Golf", "Gymnastique", "Handball", "Hippisme", "Hockey-sur-Glace",
  "Hommes & Femmes", "Insolite", "Institutions", "International", "Judo", "Karate",
  "LA28", "Marques & Entreprises", "Médias", "Merchandising", "Milan Cortina 2026",
  "MMA", "Natation", "Paris 2024", "Patinage artistique", "Podcast", "RSE", "Rugby",
  "Ski", "Sponsoring", "Sports de combat", "Sports de glisse", "Sports mécaniques",
  "Stades & Arenas", "Sumo", "Tennis / Padel", "Tennis de table", "Tir",
  "Tous les sports", "Trail", "Triathlon", "Vidéo", "Voile", "Volleyball"
].sort();

function ShareForm() {
  const searchParams = useSearchParams();
  const urlParam = searchParams.get("url") ?? "";
  const titleParam = searchParams.get("title") ?? "";

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    setUrl(urlParam);
    setTitle(titleParam);
  }, [urlParam, titleParam]);

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
          category: category || undefined,
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
      setCategory("");
    } catch {
      setStatus("error");
      setErrorMessage("Erreur réseau");
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-[#0f0f0f] dark:text-[#ededed] px-4 py-6 sm:px-6 lg:px-8 font-sans">
      <div className="mx-auto max-w-xl space-y-8">
        <header>
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            Enregistrer un article
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Vérifiez l’URL, le titre et la catégorie avant d’enregistrer.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm dark:border-[#262626] dark:bg-[#161616]"
        >
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 dark:border-[#262626] dark:bg-[#0f0f0f] dark:text-[#ededed]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Titre
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'article"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 dark:border-[#262626] dark:bg-[#0f0f0f] dark:text-[#ededed]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Catégorie
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-blue-500 dark:border-[#262626] dark:bg-[#0f0f0f] dark:text-[#ededed]"
            >
              <option value="" disabled>
                Choisissez une catégorie…
              </option>
              {VALID_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {status === "success" && (
            <p className="text-xs font-medium text-emerald-500">
              ✅ Article sauvegardé !
            </p>
          )}
          {status === "error" && (
            <p className="text-xs text-red-500">{errorMessage}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={status === "loading" || !url.trim() || !category}
              className="inline-flex items-center justify-center rounded-md border border-blue-600 bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 hover:bg-blue-700"
            >
              {status === "loading" ? "Enregistrement…" : "Sauvegarder"}
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-[#262626] dark:text-gray-300 dark:hover:bg-[#1f1f1f]"
            >
              Retour
            </Link>
          </div>
        </form>

        <section className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-white p-4 text-xs shadow-sm dark:border-[#262626] dark:bg-[#161616]">
          <h2 className="text-sm font-semibold">Bookmarklet</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Pour partager en 1 clic depuis Safari, faites glisser ce bouton
            dans votre barre de favoris :
          </p>
          <a
            href={BOOKMARKLET_CODE}
            draggable
            className="inline-block cursor-grab select-none rounded-md bg-amber-400 px-4 py-2 text-xs font-semibold text-gray-900 shadow-sm transition hover:bg-amber-300 active:cursor-grabbing"
          >
            📌 Partager vers Feedly Like
          </a>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ou copiez ce code manuellement :
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={BOOKMARKLET_CODE}
              className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-mono text-gray-700 dark:border-[#262626] dark:bg-[#0f0f0f] dark:text-gray-300"
            />
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(BOOKMARKLET_CODE);
                setCodeCopied(true);
                setTimeout(() => setCodeCopied(false), 2000);
              }}
              className="shrink-0 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-[#262626] dark:text-gray-200 dark:hover:bg-[#1f1f1f]"
            >
              {codeCopied ? "Copié !" : "Copier"}
            </button>
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Sur iOS : appuyez longuement sur ce bouton → Copier le lien → Créez
            un favori manuellement dans Safari et remplacez l&apos;URL par le
            lien copié.
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
        <div className="flex min-h-screen items-center justify-center bg-white text-gray-500 dark:bg-[#0f0f0f]">
          Chargement…
        </div>
      }
    >
      <ShareForm />
    </Suspense>
  );
}
