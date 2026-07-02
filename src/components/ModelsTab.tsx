import { useEffect, useState } from "react";
import { CURATED_MODELS, isModelCached, preloadModel, clearModelCache, type EngineProgress } from "../lib/translate";
import { OCR_LANGUAGES } from "../lib/langs";
import { isOcrLangCached, recognizeImage } from "../lib/ocr";
import { cn } from "../utils/cn";

export default function ModelsTab() {
  const [cached, setCached] = useState<Record<string, boolean>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [ocrCached, setOcrCached] = useState<Record<string, boolean>>({});
  const [ocrLoadingId, setOcrLoadingId] = useState<string | null>(null);

  const refreshCacheStatus = async () => {
    const entries = await Promise.all(CURATED_MODELS.map(async (m) => [m.repoId, await isModelCached(m.repoId)] as const));
    setCached(Object.fromEntries(entries));
    const ocrEntries = await Promise.all(
      OCR_LANGUAGES.map(async (l) => [l.code, await isOcrLangCached(l.code)] as const),
    );
    setOcrCached(Object.fromEntries(ocrEntries));
  };

  useEffect(() => {
    refreshCacheStatus();
  }, []);

  const download = async (repoId: string) => {
    setLoadingId(repoId);
    setError("");
    setProgress(0);
    try {
      await preloadModel(repoId, (p: EngineProgress) => {
        if (typeof p.progress === "number") setProgress(p.progress);
      });
      await refreshCacheStatus();
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
      // 1x1 weißes Pixel reicht, um Tesseract zum Laden der Sprachdaten zu bewegen.
      const canvas = document.createElement("canvas");
      canvas.width = 10;
      canvas.height = 10;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 10, 10);
      await recognizeImage(canvas, [code]);
      await refreshCacheStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOcrLoadingId(null);
    }
  };

  const handleClearAll = async () => {
    await clearModelCache();
    await refreshCacheStatus();
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
          {CURATED_MODELS.map((m) => (
            <div key={m.repoId} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{m.label}</p>
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
        <button onClick={handleClearAll} className="mt-4 text-xs text-red-300 underline">
          Gesamten Modell-Cache löschen
        </button>
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
