// -----------------------------------------------------------------------
// OCR-Engine (Tesseract.js) — WICHTIG für echte Offline-Fähigkeit:
//
// Tesseract.js selbst wird ganz normal per npm installiert und mit dem
// App-Code zusammen gebaut ("import ... from 'tesseract.js'"). Es gibt
// KEIN dynamisches Nachladen der Bibliothek von einem CDN zur Laufzeit.
// Das bedeutet: Der komplette Programmcode landet fest in der APK und
// funktioniert sofort ohne Internetverbindung.
//
// Einzig die Sprachdaten (*.traineddata, pro Sprache ca. 2–15 MB) müssen
// einmalig heruntergeladen werden — das ist unvermeidbar, da diese Dateien
// zu groß sind, um sie fest einzubauen. Tesseract.js speichert sie danach
// automatisch dauerhaft in der IndexedDB des Geräts. Ab dem zweiten Scan
// mit derselben Sprache ist also KEINE Internetverbindung mehr nötig,
// auch nicht im Flugmodus.
// -----------------------------------------------------------------------
import { createWorker, type Worker } from "tesseract.js";

// Die API-Schicht von Tesseract.js (das, was dieser Code direkt aufruft)
// ist per npm installiert und fest im App-Bundle enthalten - dafür ist
// also niemals Internet nötig.
//
// Der eigentliche Erkennungs-"Motor" besteht zusätzlich aus einer
// Worker-Skriptdatei und WASM-Rechenkernen (insgesamt mehrere MB). Diese
// lassen sich nicht sinnvoll in ein einzelnes HTML-Bundle einbetten, ohne
// die App unnötig aufzublähen bzw. den Build zum Absturz zu bringen.
// Sie werden daher - wie die Sprachdaten - einmalig heruntergeladen. Damit
// garantiert die zur installierten Version passenden Dateien verwendet
// werden, ist die Version hier fest verankert ("pinned"), und der Browser
// cached beide Dateien danach wie gewohnt (HTTP-Cache).
const TESSERACT_VERSION = "5.1.1";
const CORE_VERSION = "5.1.1";
const workerUrl = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`;
const corePath = `https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VERSION}`;

export interface OcrProgress {
  label: string;
  pct: number;
}

export type PsmMode = "auto" | "single_block" | "single_line" | "sparse_text";

const PSM_VALUES: Record<PsmMode, string> = {
  auto: "3",
  single_block: "6",
  single_line: "7",
  sparse_text: "11",
};

export const PSM_OPTIONS: { value: PsmMode; label: string }[] = [
  { value: "auto", label: "Automatisch (Standard)" },
  { value: "single_block", label: "Einzelner Textblock (z.B. Brief-Absatz)" },
  { value: "single_line", label: "Einzelne Zeile" },
  { value: "sparse_text", label: "Verstreuter Text (z.B. Formular, Schild)" },
];

/** Graustufen + einfache Kontrastspreizung, verbessert oft die Erkennungsrate. */
export function preprocessCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  let min = 255;
  let max = 0;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[i / 4] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < gray.length; i++) {
    const stretched = ((gray[i] - min) / range) * 255;
    const idx = i * 4;
    data[idx] = data[idx + 1] = data[idx + 2] = stretched;
  }
  ctx.putImageData(imageData, 0, 0);
  return out;
}



/**
 * Prüft (best effort), ob die Sprachdaten für die angegebene(n) Sprache(n)
 * bereits lokal im Browser-/App-Speicher (IndexedDB) zwischengespeichert
 * sind. Das ist der Speicher, den Tesseract.js für heruntergeladene
 * *.traineddata Dateien verwendet.
 */
export async function isOcrLangCached(lang: string): Promise<boolean> {
  try {
    return await new Promise<boolean>((resolve) => {
      const req = indexedDB.open("keyval-store");
      req.onerror = () => resolve(false);
      req.onsuccess = () => {
        const db = req.result;
        try {
          if (!db.objectStoreNames.contains("keyval")) {
            db.close();
            resolve(false);
            return;
          }
          const tx = db.transaction("keyval", "readonly");
          const store = tx.objectStore("keyval");
          const getAllKeysReq = store.getAllKeys();
          getAllKeysReq.onsuccess = () => {
            const keys = (getAllKeysReq.result as string[]) || [];
            db.close();
            resolve(keys.some((k) => String(k).includes(lang)));
          };
          getAllKeysReq.onerror = () => {
            db.close();
            resolve(false);
          };
        } catch {
          resolve(false);
        }
      };
    });
  } catch {
    return false;
  }
}

/**
 * Führt Texterkennung auf einem Bild (oder Bildausschnitt) aus.
 * Erstellt bei jedem Aufruf einen frischen Worker und beendet ihn danach
 * wieder (einfacher & robuster für eine Scan-Aktion pro Bild).
 */
export async function recognizeImage(
  source: HTMLCanvasElement | string,
  langs: string[],
  onProgress?: (p: OcrProgress) => void,
  options?: { psm?: PsmMode },
): Promise<string> {
  const langString = langs.length > 0 ? langs.join("+") : "deu";

  onProgress?.({ label: "OCR-Engine wird gestartet …", pct: 0 });

  let worker: Worker;
  try {
    worker = await createWorker(langString, 1, {
      workerPath: workerUrl,
      corePath,
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") {
          onProgress?.({ label: `Text wird erkannt … ${Math.round(m.progress * 100)} %`, pct: m.progress });
        } else if (m.status.includes("loading") || m.status.includes("load")) {
          onProgress?.({ label: "Sprachdaten werden geladen (einmalig) …", pct: m.progress ?? 0 });
        } else {
          onProgress?.({ label: m.status, pct: m.progress ?? 0 });
        }
      },
    });
  } catch (err) {
    throw new Error(
      "OCR-Engine konnte nicht gestartet werden. Für diese Sprache werden beim allerersten Scan " +
        "einmalig Sprachdaten aus dem Internet geladen — bitte einmal mit WLAN/Mobilfunk verbinden. " +
        "Danach funktioniert der Scan dauerhaft offline. (" +
        (err instanceof Error ? err.message : String(err)) +
        ")",
    );
  }

  if (options?.psm) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await worker.setParameters({ tessedit_pageseg_mode: PSM_VALUES[options.psm] as any });
  }

  try {
    const { data } = await worker.recognize(source);
    return (data.text ?? "").trim();
  } finally {
    await worker.terminate();
  }
}

/** Schneidet einen rechteckigen Bereich aus einem Bild aus und liefert ihn als Canvas zurück. */
export function cropImageToCanvas(
  image: HTMLImageElement,
  rect: { x: number; y: number; width: number; height: number },
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar");
  ctx.drawImage(image, rect.x, rect.y, w, h, 0, 0, w, h);
  return canvas;
}
