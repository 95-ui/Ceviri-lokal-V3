// Sprach-Hilfsfunktionen: OCR-Sprachcodes (Tesseract) und BCP-47 Codes
// für die Sprachausgabe (SpeechSynthesis).

export const OCR_LANGUAGES: { code: string; label: string }[] = [
  { code: "deu", label: "Deutsch" },
  { code: "tur", label: "Türkisch" },
  { code: "eng", label: "Englisch" },
  { code: "fra", label: "Französisch" },
  { code: "spa", label: "Spanisch" },
  { code: "ita", label: "Italienisch" },
];

const BCP47: Record<string, string> = {
  deu: "de-DE",
  tur: "tr-TR",
  eng: "en-US",
  fra: "fr-FR",
  spa: "es-ES",
  ita: "it-IT",
  deu_Latn: "de-DE",
  tur_Latn: "tr-TR",
  eng_Latn: "en-US",
  fra_Latn: "fr-FR",
  spa_Latn: "es-ES",
  ita_Latn: "it-IT",
  nld_Latn: "nl-NL",
  rus_Cyrl: "ru-RU",
  arb_Arab: "ar-SA",
  pol_Latn: "pl-PL",
};

export function guessBcp47(code: string): string {
  return BCP47[code] ?? "de-DE";
}
