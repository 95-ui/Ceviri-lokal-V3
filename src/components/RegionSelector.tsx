import { useCallback, useRef, useState } from "react";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_SIZE = 0.02;
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];
type DragMode = "none" | "draw" | "move" | "resize";

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export default function RegionSelector({
  imageUrl,
  selection,
  onChange,
  panMode = false,
}: {
  imageUrl: string;
  selection: Rect | null;
  onChange: (r: Rect | null) => void;
  panMode?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<DragMode>("none");
  const [handle, setHandle] = useState<Handle | null>(null);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [startRect, setStartRect] = useState<Rect | null>(null);
  const [workingRect, setWorkingRect] = useState<Rect | null>(null);

  const relPoint = useCallback((e: React.PointerEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    };
  }, []);

  const beginDraw = (e: React.PointerEvent) => {
    if (panMode || !containerRef.current) return;
    containerRef.current.setPointerCapture(e.pointerId);
    const p = relPoint(e);
    setMode("draw");
    setStartPoint(p);
    setWorkingRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const beginMove = (e: React.PointerEvent) => {
    if (panMode || !selection) return;
    e.stopPropagation();
    containerRef.current?.setPointerCapture(e.pointerId);
    setMode("move");
    setStartPoint(relPoint(e));
    setStartRect(selection);
    setWorkingRect(selection);
  };

  const beginResize = (h: Handle) => (e: React.PointerEvent) => {
    if (panMode || !selection) return;
    e.stopPropagation();
    containerRef.current?.setPointerCapture(e.pointerId);
    setMode("resize");
    setHandle(h);
    setStartPoint(relPoint(e));
    setStartRect(selection);
    setWorkingRect(selection);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode === "none" || !startPoint) return;
    const p = relPoint(e);

    if (mode === "draw") {
      setWorkingRect({
        x: Math.min(startPoint.x, p.x),
        y: Math.min(startPoint.y, p.y),
        w: Math.abs(p.x - startPoint.x),
        h: Math.abs(p.y - startPoint.y),
      });
      return;
    }

    if (mode === "move" && startRect) {
      const dx = p.x - startPoint.x;
      const dy = p.y - startPoint.y;
      setWorkingRect({
        x: clamp(startRect.x + dx, 0, 1 - startRect.w),
        y: clamp(startRect.y + dy, 0, 1 - startRect.h),
        w: startRect.w,
        h: startRect.h,
      });
      return;
    }

    if (mode === "resize" && startRect && handle) {
      const left0 = startRect.x;
      const right0 = startRect.x + startRect.w;
      const top0 = startRect.y;
      const bottom0 = startRect.y + startRect.h;

      const left = handle.includes("w") ? clamp(p.x, 0, right0 - MIN_SIZE) : left0;
      const right = handle.includes("e") ? clamp(p.x, left0 + MIN_SIZE, 1) : right0;
      const top = handle.includes("n") ? clamp(p.y, 0, bottom0 - MIN_SIZE) : top0;
      const bottom = handle.includes("s") ? clamp(p.y, top0 + MIN_SIZE, 1) : bottom0;

      setWorkingRect({ x: left, y: top, w: right - left, h: bottom - top });
    }
  };

  const onPointerUp = () => {
    if (mode === "draw" && workingRect && workingRect.w >= MIN_SIZE && workingRect.h >= MIN_SIZE) {
      onChange(workingRect);
    } else if ((mode === "move" || mode === "resize") && workingRect) {
      onChange(workingRect);
    }
    setMode("none");
    setHandle(null);
    setStartPoint(null);
    setStartRect(null);
    setWorkingRect(null);
  };

  const active = workingRect ?? selection;

  const handleCursor: Record<Handle, string> = {
    nw: "nwse-resize",
    n: "ns-resize",
    ne: "nesw-resize",
    e: "ew-resize",
    se: "nwse-resize",
    s: "ns-resize",
    sw: "nesw-resize",
    w: "ew-resize",
  };
  const handlePos: Record<Handle, { left: string; top: string }> = {
    nw: { left: "0%", top: "0%" },
    n: { left: "50%", top: "0%" },
    ne: { left: "100%", top: "0%" },
    e: { left: "100%", top: "50%" },
    se: { left: "100%", top: "100%" },
    s: { left: "50%", top: "100%" },
    sw: { left: "0%", top: "100%" },
    w: { left: "0%", top: "50%" },
  };

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden rounded-2xl border border-white/10 ${panMode ? "touch-auto" : "touch-none"}`}
      onPointerDown={beginDraw}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img src={imageUrl} alt="Gewähltes Dokument" className="block w-full pointer-events-none" draggable={false} />
      {active && (
        <div
          className="absolute border-2 border-indigo-400 bg-indigo-400/20"
          style={{
            left: `${active.x * 100}%`,
            top: `${active.y * 100}%`,
            width: `${active.w * 100}%`,
            height: `${active.h * 100}%`,
            cursor: panMode ? "default" : "move",
          }}
          onPointerDown={beginMove}
        >
          {!panMode &&
            HANDLES.map((h) => (
              <div
                key={h}
                onPointerDown={beginResize(h)}
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-indigo-300 bg-[#0a0d13]"
                style={{ left: handlePos[h].left, top: handlePos[h].top, cursor: handleCursor[h] }}
              />
            ))}
        </div>
      )}
    </div>
  );
}
