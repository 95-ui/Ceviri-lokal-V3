import { useCallback, useRef, useState } from "react";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_SIZE = 0.02;

export default function RegionSelector({
  imageUrl,
  selection,
  onChange,
}: {
  imageUrl: string;
  selection: Rect | null;
  onChange: (r: Rect | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<Rect | null>(null);

  const relPoint = useCallback((e: React.PointerEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1),
      y: Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1),
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    containerRef.current.setPointerCapture(e.pointerId);
    setDragStart(relPoint(e));
    setDragRect(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart) return;
    const p = relPoint(e);
    setDragRect({
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      w: Math.abs(p.x - dragStart.x),
      h: Math.abs(p.y - dragStart.y),
    });
  };

  const onPointerUp = () => {
    if (dragRect && dragRect.w >= MIN_SIZE && dragRect.h >= MIN_SIZE) {
      onChange(dragRect);
    }
    setDragStart(null);
    setDragRect(null);
  };

  const active = dragRect ?? selection;

  return (
    <div
      ref={containerRef}
      className="relative touch-none select-none overflow-hidden rounded-2xl border border-white/10"
      onPointerDown={onPointerDown}
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
          }}
        />
      )}
    </div>
  );
}
