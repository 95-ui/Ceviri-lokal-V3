import { useEffect, useState } from "react";
import ScanTab from "./components/ScanTab";
import TranslateTab from "./components/TranslateTab";
import ModelsTab from "./components/ModelsTab";
import InfoTab from "./components/InfoTab";
import OnlineBadge from "./components/OnlineBadge";
import { cn } from "./utils/cn";

type TabId = "scan" | "translate" | "models" | "info";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "scan", label: "Scannen", icon: "📷" },
  { id: "translate", label: "Übersetzen", icon: "🌐" },
  { id: "models", label: "Modelle", icon: "⬇️" },
  { id: "info", label: "Info", icon: "ℹ️" },
];

const NEON_KEY = "ceviri_neon_theme";

export default function App() {
  const [tab, setTab] = useState<TabId>("scan");
  const [pendingText, setPendingText] = useState("");
  const [neon, setNeon] = useState(() => localStorage.getItem(NEON_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(NEON_KEY, neon ? "1" : "0");
  }, [neon]);

  return (
    <div className={cn("min-h-screen bg-[#0a0d13] text-slate-200", neon && "theme-neon")}>
      <header className="border-b border-white/10 bg-[#0d1119]/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-lg font-bold text-white">Çeviri Lokal</h1>
            <p className="text-xs text-slate-500">Offline Scan &amp; Übersetzung — Deutsch ⇄ Türkisch</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNeon((v) => !v)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                neon
                  ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-300"
                  : "border-white/15 text-slate-400 hover:bg-white/10",
              )}
              title="Neon-Design ein-/ausschalten"
            >
              ✨ Neon {neon ? "an" : "aus"}
            </button>
            <OnlineBadge />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition",
                tab === t.id ? "bg-indigo-500 text-white" : "text-slate-400 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "scan" && (
          <ScanTab
            onTextRecognized={(text) => {
              setPendingText(text);
              setTab("translate");
            }}
          />
        )}
        {tab === "translate" && (
          <TranslateTab initialText={pendingText} onConsumedInitialText={() => setPendingText("")} />
        )}
        {tab === "models" && <ModelsTab />}
        {tab === "info" && <InfoTab />}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-8 pt-2 text-center text-xs text-slate-600 sm:px-6">
        Alle Daten bleiben auf deinem Gerät. Internet wird nur zum einmaligen Herunterladen der Modelle benötigt.
      </footer>
    </div>
  );
}
