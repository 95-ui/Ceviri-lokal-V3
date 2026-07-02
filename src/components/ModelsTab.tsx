import { useEffect, useState } from "react";
import {
  getAllModels,
  isModelCached,
  preloadModel,
  clearModelCache,
  addCustomModel,
  removeCustomModel,
  isCuratedModel,
  type EngineProgress,
  type ModelDefinition,
} from "../lib/translate";
import { OCR_LANGUAGES } from "../lib/langs";
import { isOcrLangCached, recognizeImage } from "../lib/ocr";
import { cn } from "../utils/cn";

type Mode = "fixed" | "multilingual";

export default function ModelsTab() {
  const [models, setModels] = useState<ModelDefinition[]>(getAllModels());
  const [cached, setCached] = useState<Record<string, boolean>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [ocrCached, setOcrCached] = useState<Record<string, boolean>>({});
  const [ocrLoadingId, setOcrLoadingId] = useState<string | null>(null);

  // Formular für "Eigenes Modell hinzufügen"
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<Mode>("fixed");
  const [repoId, setRepoId] = useState("");
  const [label, setLabel] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [targetLabel, setTargetLabel] = useState("");
  const [langsText, setLangsText] = useState("");
  const [formError, setFormError] = useState("");

  const refreshCacheStatus = async (list: ModelDefinition[]) => {
    const entries = await Promise.all(list.map(async (m) => [m.repoId, await isModelCached(m.repoId)] as const));
    setCached(Object.fromEntries(entries));
    const ocrEntries = await Promise.all(
      OCR_LANGUAGES.map(async (l) => [l.code, await isOcrLangCached(l.code)] as const),
    );
    setOcrCached(Object.fromEntries(ocrEntries));
  };

  const refreshAll = () => {
    const list = getAllModels();
    setModels(list);
    refreshCacheStatus(list);
  };

  useEffect(() => {
    refreshAll();
    window.addEventListener("custom-models-changed", refreshAll);
    return () => window.removeEventListener("custom-models-changed", refreshAll);
  }, []);

  const download = async (repoId: string) => {
    setLoadingId(repoId);
    setError("");
    setProgress(0);
    try {
      await preloadModel(repoId, (p: EngineProgress) => {
        if (typeof p.progress === "number") setProgress(p.progress);
      });
      await refreshCacheStatus(models);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingId(null);
      setProgress(0);
    }
  };

  const downloadOcrLang = async (code: string) => {
    setOcrLoadingId(code);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 10, 10);
      await recognizeImage(canvas, [code]);
      await refreshCacheStatus(models);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOcrLoadingId(null);
    }
  };

  const handleClearAll = async () => {
    await clearModelCache();
    await refreshCacheStatus(models);
  };

  const resetForm = () => {
    setRepoId("");
    setLabel("");
    setSourceLabel("");
    setTargetLabel("");
    setLangsText("");
    setFormError("");
  };

  const handleAddModel = () => {
    setFormError("");
    if (!repoId.trim()) {
      setFormError("Bitte eine Repo-ID angeben, z.B. Xenova/opus-mt-de-en");
      return;
    }
    if (models.some((m) => m.repoId === repoId.trim())) {
      setFormError("Ein Modell mit dieser Repo-ID existiert schon.");
      return;
    }

    let def: ModelDefinition;
    if (mode === "fixed") {
      if (!sourceLabel.trim() || !targetLabel.trim()) {
        setFormError("Bitte Quell- und Zielsprache angeben (z.B. Deutsch / Türkisch).");
        return;
      }
      def = {
        repoId: repoId.trim(),
        label: label.trim() || `${sourceLabel} → ${targetLabel} (eigenes Modell)`,
        description: "Eigenes hinzugefügtes Modell mit festem Sprachpaar.",
        multilingual: false,
        fixedPair: {
          sourceLabel: sourceLabel.trim(),
          targetLabel: targetLabel.trim(),
          sourceCode: "",
          targetCode: "",
        },
        sizeHint: "unbekannt",
      };
    } else {
      // Format: "code:Label, code:Label" z.B. "deu_Latn:Deutsch, tur_Latn:Türkisch"
      const languages = langsText
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const [code, ...rest] = part.split(":");
          return { code: (code ?? "").trim(), label: (rest.join(":") || code).trim() };
        })
        .filter((l) => l.code);

      if (languages.length < 2) {
        setFormError(
          'Bitte mindestens 2 Sprachen im Format "code:Label" angeben, kommagetrennt, ' +
            "z.B. deu_Latn:Deutsch, tur_Latn:Türkisch",
        );
        return;
      }
      def = {
        repoId: repoId.trim(),
        label: label.trim() || repoId.trim(),
        description: "Eigenes hinzugefügtes mehrsprachiges Modell.",
        multilingual: true,
        languages,
        sizeHint: "unbekannt",
      };
    }

    addCustomModel(def);
    resetForm();
    setShowForm(false);
  };

  const handleRemove = (id: string) => {
    if (confirm("Dieses Modell wirklich entfernen? (Bereits heruntergeladene Dateien bleiben im Cache.)")) {
      removeCustomModel(id);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Modelle für den Offline-Betrieb herunterladen</h2>
        <p className="mt-2 text-sm text-slate-400">
          Lade hier — <span className="text-white">einmalig, solange du online bist</span> (z.&nbsp;B. per WLAN) —
          die Übersetzungsmodelle und OCR-Sprachpakete herunter, die du benötigst. Sie werden dauerhaft auf dem
          Gerät gespeichert. Danach funktionieren Scan &amp; Übersetzung <span className="text-white">vollständig
          offline</span>, auch im Flugmodus.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">Übersetzungsmodelle</h3>
        <div className="space-y-3">
          {models.map((m) => (
            <div key={m.repoId} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">
                    {m.label}
                    {!isCuratedModel(m.repoId) && (
                      <span className="ml-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2 py-0.5 text-[10px] text-indigo-300">
                        eigenes Modell
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{m.description}</p>
                  <p className="mt-1 text-xs text-slate-500">Größe: {m.sizeHint}</p>
                </div>
                <div className="flex items-center gap-2">
                  {cached[m.repoId] ? (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                      ✓ Offline verfügbar
                    </span>
                  ) : (
                    <button
                      onClick={() => download(m.repoId)}
                      disabled={loadingId === m.repoId}
                      className={cn(
                        "rounded-lg bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-400",
                        loadingId === m.repoId && "cursor-not-allowed opacity-60",
                      )}
                    >
                      {loadingId === m.repoId ? `Lädt … ${Math.round(progress)}%` : "Herunterladen"}
                    </button>
                  )}
                  {!isCuratedModel(m.repoId) && (
                    <button
                      onClick={() => handleRemove(m.repoId)}
                      className="rounded-lg border border-red-400/30 px-3 py-2 text-xs text-red-300 hover:bg-red-400/10"
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
              {loadingId === m.repoId && (
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-indigo-400 transition-all" style={{ width: `${Math.round(progress)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button onClick={handleClearAll} className="text-xs text-red-300 underline">
            Gesamten Modell-Cache löschen
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg border border-indigo-400/40 px-4 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-400/10"
          >
            {showForm ? "Formular schließen" : "+ Eigenes Modell hinzufügen"}
          </button>
        </div>

        {showForm && (
          <div className="mt-4 space-y-3 rounded-xl border border-indigo-400/30 bg-indigo-400/5 p-4">
            <p className="text-xs text-slate-400">
              Trage die Repo-ID eines für <span className="text-white">Transformers.js</span> konvertierten
              Modells von huggingface.co ein (z.&nbsp;B. <code>Xenova/opus-mt-de-en</code>). Suche auf
              huggingface.co nach Tag <code>transformers.js</code> + <code>translation</code>, um passende
              Modelle zu finden.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setMode("fixed")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs",
                  mode === "fixed" ? "bg-indigo-500 text-white" : "border border-white/15 text-slate-300",
                )}
              >
                Festes Sprachpaar (z.B. OPUS-MT)
              </button>
              <button
                onClick={() => setMode("multilingual")}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs",
                  mode === "multilingual" ? "bg-indigo-500 text-white" : "border border-white/15 text-slate-300",
                )}
              >
                Mehrsprachig (z.B. NLLB-Style)
              </button>
            </div>

            <div>
              <label className="text-xs text-slate-400">Repo-ID (Pflicht)</label>
              <input
                value={repoId}
                onChange={(e) => setRepoId(e.target.value)}
                placeholder="z.B. Xenova/opus-mt-de-en"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400">Anzeigename (optional)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z.B. Deutsch → Türkisch (eigenes Modell)"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              />
            </div>

            {mode === "fixed" ? (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-slate-400">Quellsprache</label>
                  <input
                    value={sourceLabel}
                    onChange={(e) => setSourceLabel(e.target.value)}
                    placeholder="Deutsch"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-slate-400">Zielsprache</label>
                  <input
                    value={targetLabel}
                    onChange={(e) => setTargetLabel(e.target.value)}
                    placeholder="Türkisch"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-400">
                  Sprachen im Format <code>code:Label</code>, kommagetrennt
                </label>
                <input
                  value={langsText}
                  onChange={(e) => setLangsText(e.target.value)}
                  placeholder="deu_Latn:Deutsch, tur_Latn:Türkisch"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
            )}

            {formError && <p className="text-xs text-red-400">{formError}</p>}

            <button
              onClick={handleAddModel}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-400"
            >
              Modell hinzufügen
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">OCR-Sprachpakete (Texterkennung)</h3>
        <div className="flex flex-wrap gap-2">
          {OCR_LANGUAGES.map((l) => (
            <div key={l.code} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <span className="text-sm text-slate-200">{l.label}</span>
              {ocrCached[l.code] ? (
                <span className="text-xs text-emerald-300">✓ offline</span>
              ) : (
                <button
                  onClick={() => downloadOcrLang(l.code)}
                  disabled={ocrLoadingId === l.code}
                  className="rounded-md border border-white/15 px-2 py-1 text-xs text-slate-200 hover:bg-white/10 disabled:opacity-50"
                >
                  {ocrLoadingId === l.code ? "Lädt …" : "Laden"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">{error}</p>}
    </div>
  );
}
