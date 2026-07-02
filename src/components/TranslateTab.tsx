import { useEffect, useMemo, useState } from "react";
import { getAllModels, splitIntoChunks, translateText, type EngineProgress } from "../lib/translate";
import { guessBcp47 } from "../lib/langs";
import { cn } from "../utils/cn";

const FONT_SIZES = [
  { cls: "text-sm", label: "Normal" },
  { cls: "text-base", label: "Groß" },
  { cls: "text-lg", label: "Größer" },
  { cls: "text-xl", label: "Sehr groß" },
  { cls: "text-2xl", label: "Riesig" },
];
const FONT_SIZE_KEY = "ceviri_font_size_index";

export default function TranslateTab({
  initialText,
  onConsumedInitialText,
}: {
  initialText: string;
  onConsumedInitialText: () => void;
}) {
  const models = useMemo(() => getAllModels(), []);
  const [modelId, setModelId] = useState(models[0].repoId);
  const [srcLang, setSrcLang] = useState("");
  const [tgtLang, setTgtLang] = useState("");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");
  const [fontSizeIdx, setFontSizeIdx] = useState(() => {
    const saved = Number(localStorage.getItem(FONT_SIZE_KEY));
    return Number.isFinite(saved) && saved >= 0 && saved < FONT_SIZES.length ? saved : 0;
  });

  const model = useMemo(() => models.find((m) => m.repoId === modelId) ?? models[0], [models, modelId]);

  useEffect(() => {
    if (initialText) {
      setInput(initialText);
      onConsumedInitialText();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  useEffect(() => {
    if (model.multilingual && model.languages) {
      setSrcLang((prev) => prev || model.languages![0].code);
      setTgtLang((prev) => prev || model.languages![1].code);
    }
  }, [model]);

  const changeFontSize = (delta: number) => {
    setFontSizeIdx((prev) => {
      const next = Math.min(FONT_SIZES.length - 1, Math.max(0, prev + delta));
      localStorage.setItem(FONT_SIZE_KEY, String(next));
      return next;
    });
  };

  const handleSwap = () => {
    if (model.multilingual) {
      setSrcLang(tgtLang);
      setTgtLang(srcLang);
    }
    setOutput("");
  };

  const handleTranslate = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const chunks = splitIntoChunks(input.trim());
      const results: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const text = await translateText(
          model.repoId,
          chunks[i],
          model.multilingual ? { srcLang, tgtLang } : {},
          (p: EngineProgress) => {
            if (p.status === "progress" && typeof p.progress === "number") {
              setProgressLabel(`Modell wird geladen (einmalig) … ${Math.round(p.progress)}%`);
            } else if (p.status) {
              setProgressLabel(
                chunks.length > 1 ? `Übersetze Abschnitt ${i + 1}/${chunks.length} …` : "Übersetze …",
              );
            }
          },
        );
        results.push(text);
      }
      setOutput(results.join(" "));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setProgressLabel("");
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  };

  const handleSpeak = () => {
    if (!output) return;
    const code = model.multilingual ? tgtLang : model.fixedPair?.targetCode ?? "deu";
    const utterance = new SpeechSynthesisUtterance(output);
    utterance.lang = guessBcp47(code);
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <label className="text-xs text-slate-400">Übersetzungsmodell</label>
        <select
          value={modelId}
          onChange={(e) => {
            setModelId(e.target.value);
            setSrcLang("");
            setTgtLang("");
            setOutput("");
          }}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
        >
          {models.map((m) => (
            <option key={m.repoId} value={m.repoId}>
              {m.label}
            </option>
          ))}
        </select>

        {model.multilingual ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-[140px] flex-1">
              <label className="text-xs text-slate-400">Von</label>
              <select
                value={srcLang}
                onChange={(e) => setSrcLang(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              >
                {model.languages?.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSwap}
              className="mb-1 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
              title="Sprachen tauschen"
            >
              ⇄
            </button>
            <div className="min-w-[140px] flex-1">
              <label className="text-xs text-slate-400">Nach</label>
              <select
                value={tgtLang}
                onChange={(e) => setTgtLang(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
              >
                {model.languages?.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            Festes Sprachpaar: <span className="text-white">{model.fixedPair?.sourceLabel}</span> →{" "}
            <span className="text-white">{model.fixedPair?.targetLabel}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-slate-400">Textgröße: {FONT_SIZES[fontSizeIdx].label}</span>
        <button
          onClick={() => changeFontSize(-1)}
          disabled={fontSizeIdx === 0}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-30"
          title="Schrift verkleinern"
        >
          A−
        </button>
        <button
          onClick={() => changeFontSize(1)}
          disabled={fontSizeIdx === FONT_SIZES.length - 1}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-30"
          title="Schrift vergrößern"
        >
          A+
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Text hier eingeben oder aus dem Scan-Tab übernehmen…"
            rows={8}
            className={cn(
              "w-full resize-none rounded-lg bg-transparent text-white placeholder:text-slate-500 outline-none",
              FONT_SIZES[fontSizeIdx].cls,
            )}
          />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {loading ? (
            <p className="text-sm text-slate-400">{progressLabel || "Übersetze …"}</p>
          ) : (
            <p className={cn("whitespace-pre-wrap text-white", FONT_SIZES[fontSizeIdx].cls)}>
              {output || "Übersetzung erscheint hier…"}
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleTranslate}
          disabled={loading || !input.trim()}
          className={cn(
            "rounded-lg bg-indigo-500 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-400",
            (loading || !input.trim()) && "cursor-not-allowed opacity-50",
          )}
        >
          Übersetzen
        </button>
        <button
          onClick={handleCopy}
          disabled={!output}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-40"
        >
          Kopieren
        </button>
        <button
          onClick={handleSpeak}
          disabled={!output}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-40"
        >
          🔊 Vorlesen
        </button>
      </div>
    </div>
  );
}
