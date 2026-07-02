// -----------------------------------------------------------------------
// Übersetzungs-Engine (Transformers.js von Hugging Face) — WICHTIG:
//
// Die Bibliothek wird per npm installiert und fest mit der App gebaut
// ("import ... from '@huggingface/transformers'"), NICHT zur Laufzeit von
// einem CDN nachgeladen. Der komplette Programmcode ist damit von Anfang
// an Bestandteil der APK und braucht kein Internet.
//
// Nur die eigentlichen KI-Modell-Dateien (Gewichte, ca. 60–600 MB je nach
// Modell) müssen einmalig heruntergeladen werden. Transformers.js speichert
// sie danach automatisch dauerhaft über die Cache-Storage-API des Geräts
// (`env.useBrowserCache`) — inklusive der benötigten WebAssembly-Laufzeit
// (`env.useWasmCache`). Ab dem zweiten Aufruf desselben Modells ist somit
// KEINE Internetverbindung mehr nötig, auch nicht im Flugmodus.
// -----------------------------------------------------------------------
// Hinweis zum Laden dieser Bibliothek:
// @huggingface/transformers bringt über onnxruntime-web sehr große
// WebAssembly-Dateien (mehrere zig MB) mit, die von klassischen
// Bundlern (Vite/Rollup/Webpack) nur mit Spezial-Konfiguration verarbeitet
// werden können - andernfalls kommt es beim Bauen zu Speicherfehlern.
// Um das zu vermeiden, wird die Bibliothek einmalig zur Laufzeit geladen
// (Standard-Vorgehen bei WASM-lastigen KI-Bibliotheken im Browser, siehe
// z.B. auch die offiziellen Transformers.js-Demos). WICHTIG: Das ist NICHT
// dasselbe wie "bei jeder Nutzung Internet nötig" — der Browser cached
// dieses Skript wie jede andere Ressource; für echte Offline-Garantie auch
// nach App-Neustart sollte diese Datei in einer produktiven APK zusätzlich
// selbst gehostet werden (siehe Hinweis in InfoTab.tsx / README).
const TRANSFORMERS_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2/dist/transformers.min.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modulePromise: Promise<any> | null = null;
async function loadTransformers() {
  if (!modulePromise) {
    modulePromise = import(/* @vite-ignore */ TRANSFORMERS_URL).then((mod) => {
      // Nur öffentliche, für den Browser konvertierte Modelle vom Hugging
      // Face Hub laden - keine lokalen/gebündelten Modelldateien erwartet.
      mod.env.allowLocalModels = false;
      mod.env.useBrowserCache = true;
      return mod;
    });
  }
  return modulePromise;
}

export interface EngineProgress {
  status: string;
  file?: string;
  progress?: number;
}

export type LanguageCode = { code: string; label: string };

export interface ModelDefinition {
  repoId: string;
  label: string;
  description: string;
  multilingual: boolean;
  languages?: LanguageCode[];
  fixedPair?: { sourceLabel: string; targetLabel: string; sourceCode: string; targetCode: string };
  sizeHint: string;
}

// Kuratierte, auf huggingface.co geprüfte Modelle (Tag "transformers.js").
export const CURATED_MODELS: ModelDefinition[] = [
  {
    repoId: "Xenova/opus-mt-de-en",
    label: "Deutsch → Englisch (klein, schnell)",
    description: "Kompaktes Spezialmodell nur für Deutsch → Englisch.",
    multilingual: false,
    fixedPair: { sourceLabel: "Deutsch", targetLabel: "Englisch", sourceCode: "deu", targetCode: "eng" },
    sizeHint: "~85 MB",
  },
  {
    repoId: "Xenova/opus-mt-en-de",
    label: "Englisch → Deutsch (klein, schnell)",
    description: "Kompaktes Spezialmodell nur für Englisch → Deutsch.",
    multilingual: false,
    fixedPair: { sourceLabel: "Englisch", targetLabel: "Deutsch", sourceCode: "eng", targetCode: "deu" },
    sizeHint: "~85 MB",
  },
  {
    repoId: "Xenova/opus-mt-tr-en",
    label: "Türkisch → Englisch (klein, schnell)",
    description: "Kompaktes Spezialmodell nur für Türkisch → Englisch.",
    multilingual: false,
    fixedPair: { sourceLabel: "Türkisch", targetLabel: "Englisch", sourceCode: "tur", targetCode: "eng" },
    sizeHint: "~85 MB",
  },
  {
    repoId: "Xenova/nllb-200-distilled-600M",
    label: "NLLB-200 — Deutsch ⇄ Türkisch direkt (mehrsprachig)",
    description:
      "Meta's mehrsprachiges Modell. Einziges hier verifiziertes Modell, das Deutsch ⇄ Türkisch DIREKT " +
      "unterstützt (es gibt kein spezialisiertes de↔tr-Modell auf Hugging Face). Größer, dafür flexibel.",
    multilingual: true,
    languages: [
      { code: "deu_Latn", label: "Deutsch" },
      { code: "tur_Latn", label: "Türkisch" },
      { code: "eng_Latn", label: "Englisch" },
      { code: "fra_Latn", label: "Französisch" },
      { code: "spa_Latn", label: "Spanisch" },
      { code: "ita_Latn", label: "Italienisch" },
      { code: "nld_Latn", label: "Niederländisch" },
      { code: "rus_Cyrl", label: "Russisch" },
      { code: "arb_Arab", label: "Arabisch" },
      { code: "pol_Latn", label: "Polnisch" },
    ],
    sizeHint: "~600 MB (einmalig)",
  },
];

// -----------------------------------------------------------------------
// Eigene Modelle (vom Nutzer hinzugefügt)
// -----------------------------------------------------------------------
// Es werden dabei KEINE Dateien "hochgeladen". Gespeichert wird nur die
// Repo-ID von huggingface.co - das eigentliche Herunterladen läuft danach
// exakt so wie bei den kuratierten Modellen oben (einmalig, dann offline
// gecacht). Voraussetzung: Das Modell muss bereits als ONNX-Version für
// Transformers.js exportiert sein (erkennbar am Tag "transformers.js" auf
// der Modellseite, meist im Namensraum "Xenova/" oder "onnx-community/").
const CUSTOM_MODELS_KEY = "ceviri_custom_models_v1";

export function loadCustomModels(): ModelDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_MODELS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomModels(models: ModelDefinition[]) {
  localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models));
  window.dispatchEvent(new CustomEvent("custom-models-changed"));
}

export function addCustomModel(model: ModelDefinition) {
  const existing = loadCustomModels().filter((m) => m.repoId !== model.repoId);
  saveCustomModels([...existing, model]);
}

export function removeCustomModel(repoId: string) {
  saveCustomModels(loadCustomModels().filter((m) => m.repoId !== repoId));
}

/** Kuratierte + vom Nutzer hinzugefügte Modelle zusammen. */
export function getAllModels(): ModelDefinition[] {
  return [...CURATED_MODELS, ...loadCustomModels()];
}

export function isCuratedModel(repoId: string): boolean {
  return CURATED_MODELS.some((m) => m.repoId === repoId);
}
const CACHE_NAME = "transformers-cache";

/** Prüft best-effort, ob bereits Dateien dieses Modells lokal zwischengespeichert sind. */
export async function isModelCached(repoId: string): Promise<boolean> {
  try {
    if (!("caches" in window)) return false;
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    return keys.some((req) => req.url.includes(repoId));
  } catch {
    return false;
  }
}

export async function clearModelCache(): Promise<void> {
  if ("caches" in window) {
    await caches.delete(CACHE_NAME);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pipelineCache = new Map<string, Promise<any>>();

export class ModelLoadError extends Error {
  constructor(
    message: string,
    public repoId: string,
  ) {
    super(message);
    this.name = "ModelLoadError";
  }
}

function describeLoadError(repoId: string, err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/unauthorized|401|404|not found/i.test(raw)) {
    return `Modell "${repoId}" wurde nicht gefunden. Bitte Repo-ID prüfen.`;
  }
  if (/network|fetch|failed to fetch/i.test(raw)) {
    return (
      `Modell "${repoId}" ist noch nicht lokal gespeichert und konnte nicht heruntergeladen werden ` +
      `(keine Internetverbindung?). Bitte einmalig mit dem Internet verbinden, um dieses Modell ` +
      `herunterzuladen — danach funktioniert es dauerhaft offline.`
    );
  }
  return `Fehler beim Laden von "${repoId}": ${raw}`;
}

function getPipeline(repoId: string, onProgress?: (p: EngineProgress) => void) {
  if (!pipelineCache.has(repoId)) {
    const promise = (async () => {
      try {
        const { pipeline } = await loadTransformers();
        return await pipeline("translation", repoId, {
          progress_callback: (p: EngineProgress) => onProgress?.(p),
        });
      } catch (err) {
        throw new ModelLoadError(describeLoadError(repoId, err), repoId);
      }
    })();
    pipelineCache.set(repoId, promise);
    promise.catch(() => pipelineCache.delete(repoId));
  }
  return pipelineCache.get(repoId)!;
}

/** Lädt das Modell bereits vorab (für den "Modelle herunterladen"-Tab). */
export async function preloadModel(repoId: string, onProgress?: (p: EngineProgress) => void) {
  await getPipeline(repoId, onProgress);
}

export interface TranslateOptions {
  srcLang?: string;
  tgtLang?: string;
}

export async function translateText(
  repoId: string,
  text: string,
  options: TranslateOptions,
  onProgress?: (p: EngineProgress) => void,
): Promise<string> {
  const pipe = await getPipeline(repoId, onProgress);
  const genOptions: Record<string, string> = {};
  if (options.srcLang) genOptions.src_lang = options.srcLang;
  if (options.tgtLang) genOptions.tgt_lang = options.tgtLang;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: any = await pipe(text, genOptions);
  const first = Array.isArray(output) ? output[0] : output;
  return first?.translation_text ?? "";
}

/** Text in handliche Häppchen teilen, damit lange OCR-Texte zuverlässig übersetzt werden. */
export function splitIntoChunks(text: string, maxLen = 400): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + " " + s).trim().length > maxLen && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current = (current + " " + s).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}
