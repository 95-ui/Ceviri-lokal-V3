import { useEffect, useState } from "react";
import { cn } from "../utils/cn";

export default function OnlineBadge() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        online
          ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
          : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
      )}
      title={online ? "Gerät ist online" : "Gerät ist offline"}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-amber-400" : "bg-emerald-400")} />
      {online ? "Online" : "Offline-Modus aktiv"}
    </span>
  );
}
