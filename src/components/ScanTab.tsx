import { useRef, useState } from "react";
import RegionSelector, { type Rect } from "./RegionSelector";
import { cropImageToCanvas, preprocessCanvas, recognizeImage, PSM_OPTIONS, type OcrProgress, type PsmMode } from "../lib/ocr";
import { OCR_LANGUAGES } from "../lib/langs";
import { cn } from "../utils/cn";

const ZOOM_STEPS = [1, 1.25, 1.5, 1.75, 2, 2.5];

export default function ScanTab({
  onTextRecognized,
}: {
  onTextRecognized: (text: string) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [ocrLangs, setOcrLangs] = useState<string[]>(["deu"]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [panMode, setPanMode] = useState(false);
  const [preprocess, setPreprocess] = useState(true);
  const [psm, setPsm] = useState<PsmMode>("auto");
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(URL.createObjectURL(file));
    setSelection(null);
    setOcrText("");
    setError(null);
    setZoomIdx(0);
    e.target.value = "";
  };

  const removeImage = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setSelection(null);
    setOcrText("");
    setError(null);
  };

  const toggleLang = (code: string) => {
    setOcrLangs((prev) => {
      if (prev.includes(code)) return prev.length === 1 ? prev : prev.filter((c) => c !== code);
      return [...prev, code];
    });
  };

  const runOcr = async () => {
    if (!imageUrl || busy) return;
    setBusy(true);
    setError(null);
    setOcrText("");
    setProgress({ label: "Bild wird vorbereitet …", pct: 0 });

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
        i.src = imageUrl;
      });

      const sel = selection;
      const rect = sel
        ? {
            x: sel.x * img.naturalWidth,
            y: sel.y * img.naturalHeight,
            width: sel.w * img.naturalWidth,
            height: sel.h * img.naturalHeight,
          }
        : { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };

      let canvas = cropImageToCanvas(img, rect);
      if (preprocess) canvas = preprocessCanvas(canvas);
      const text = await recognizeImage(canvas, ocrLangs, setProgress, { psm });

      if (!text) {
        setError("Kein Text erkannt. Versuche einen schärferen Ausschnitt, mehr Licht oder ein anderes Layout unten.");
      } else {
        setOcrText(text);
        onTextRecognized(text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const zoom = ZOOM_STEPS[zoomIdx];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Bild / Brief scannen</h2>
        <p className="mt-1 text-sm text-slate-400">
          Lade ein Foto oder einen Scan hoch. Du kannst optional per Markieren nur einen bestimmten Bereich
          auswählen, der erkannt werden soll. Die Texterkennung läuft komplett auf dem Gerät.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
          >
            📷 Foto aufnehmen
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
          >
            🖼️ Aus Galerie wählen
          </button>
          {imageUrl && (
            <button
              onClick={removeImage}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Entfernen
            </button>
          )}
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPickFile}
          className="hidden"
        />
        <input ref={galleryInputRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />
      </section>

      {imageUrl && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Zoom: {Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
                disabled={zoomIdx === 0}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-30"
              >
                −
              </button>
              <button
                onClick={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
                disabled={zoomIdx === ZOOM_STEPS.length - 1}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-30"
              >
                +
              </button>
            </div>
            <button
              onClick={() => setPanMode((v) => !v)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs",
                panMode
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                  : "border-white/15 text-slate-300 hover:bg-white/10",
              )}
              title="Umschalten zwischen Markieren und Verschieben des gezoomten Bildes"
            >
              {panMode ? "✋ Verschieben aktiv" : "✋ Verschieben"}
            </button>
          </div>

          <div className="max-h-[65vh] overflow-auto rounded-2xl">
            <div style={{ width: `${zoom * 100}%` }}>
              <RegionSelector imageUrl={imageUrl} selection={selection} onChange={setSelection} panMode={panMode} />
            </div>
          </div>

          <p className="text-xs text-slate-500">
            {panMode
              ? "Verschieben-Modus: Wische, um im gezoomten Bild zu navigieren."
              : "Ziehe ein Rechteck über den zu erkennenden Bereich. Eine bestehende Markierung kannst du an den Punkten ziehen, um sie zu vergrößern/verkleinern, oder in der Mitte anfassen, um sie zu verschieben."}
          </p>
          {selection && (
            <button onClick={() => setSelection(null)} className="text-xs text-indigo-300 underline">
              Auswahl zurücksetzen
            </button>
          )}

          <div>
            <p className="mb-2 text-xs text-slate-400">Texterkennungs-Sprache(n):</p>
            <div className="flex flex-wrap gap-2">
              {OCR_LANGUAGES.map((l) => {
                const active = ocrLangs.includes(l.code);
                return (
                  <button
                    key={l.code}
                    onClick={() => toggleLang(l.code)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs",
                      active
                        ? "border-indigo-400 bg-indigo-400/20 text-indigo-200"
                        : "border-white/15 text-slate-300 hover:bg-white/10",
                    )}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-400">Layout (hilft bei schlecht erkanntem Text)</label>
              <select
                value={psm}
                onChange={(e) => setPsm(e.target.value as PsmMode)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              >
                {PSM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end text-xs text-slate-300">
              <input type="checkbox" checked={preprocess} onChange={(e) => setPreprocess(e.target.checked)} />
              Bildqualität verbessern (Kontrast/Graustufen)
            </label>
          </div>

          <button
            onClick={runOcr}
            disabled={busy}
            className={cn(
              "rounded-lg bg-emerald-500 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-400",
              busy && "cursor-not-allowed opacity-50",
            )}
          >
            {busy ? "Scan läuft …" : "Text erkennen (offline)"}
          </button>

          {progress && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400">{progress.label}</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{ width: `${Math.round(progress.pct * 100)}%` }}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">{error}</p>
      )}

      {ocrText && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white">Erkannter Text</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{ocrText}</p>
          <p className="mt-3 text-xs text-indigo-300">→ Wurde automatisch in den „Übersetzen"-Tab übernommen.</p>
        </section>
      )}
    </div>
  );
}
