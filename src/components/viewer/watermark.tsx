"use client";

/** Tiled, rotated identity overlay. Rendered above the document, below the controls. */
export function Watermark({ text }: { text: string }) {
  const rows = 14;
  const cols = 4;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <span key={`${r}-${c}`} style={{ top: `${(r / rows) * 100}%`, left: `${(c / cols) * 100 + (r % 2 ? 12 : 0)}%`, fontSize: "clamp(11px, 1.4vw, 16px)" }}>
          {text}
        </span>,
      );
    }
  }
  return (
    <div className="watermark-layer" aria-hidden>
      {cells}
    </div>
  );
}
