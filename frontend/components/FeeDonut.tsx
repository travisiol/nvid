"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE } from "@/components/motion";
import { tokenomics, type SplitTone } from "@/lib/site";

export const SPLIT_COLORS: Record<SplitTone, string> = {
  accent: "#76B900",
  foreground: "#EDEDED",
  muted: "#3A3A3A",
};

const SIZE = 320;
const STROKE = 16;
const GAP = 3; // px of track left visible between segments
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** Legend shared by the SVG donut and the 3D ring. */
export function SplitLegend() {
  return (
    <figcaption className="grid w-full max-w-sm gap-3">
      {tokenomics.split.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-4 text-[13px]">
          <span className="flex items-center gap-2.5">
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: SPLIT_COLORS[item.tone] }} />
            <span>{item.label}</span>
          </span>
          <span className="tabular text-muted-foreground">
            {item.shareOfFee}% of fee · {item.pctOfVolume}% of volume
          </span>
        </div>
      ))}
    </figcaption>
  );
}

/**
 * The 2% fee as a ring: 50% NVDA rewards, 25% liquidity, 25% treasury.
 * Pure SVG, draws itself in on scroll. Used where WebGL is unavailable.
 */
export function FeeDonut() {
  const reduce = useReducedMotion();

  let cursor = 0;
  const segments = tokenomics.split.map((item) => {
    const length = C * (item.shareOfFee / 100);
    const segment = { ...item, length, offset: cursor };
    cursor += length;
    return segment;
  });

  const label = tokenomics.split.map((s) => `${s.shareOfFee}% ${s.label}`).join(", ");

  return (
    <figure className="flex w-full flex-col items-center gap-10">
      <div className="relative w-full max-w-[320px]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full" role="img" aria-label={`Fee split: ${label}`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="#1A1A1A" strokeWidth={STROKE} />
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {segments.map((segment, i) => {
              const visible = Math.max(0, segment.length - GAP);
              const finalDash = `${visible} ${C - visible}`;
              return (
                <motion.circle
                  key={segment.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={SPLIT_COLORS[segment.tone]}
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                  strokeDashoffset={-segment.offset}
                  initial={reduce ? { strokeDasharray: finalDash, opacity: 1 } : { strokeDasharray: `0 ${C}`, opacity: 0 }}
                  whileInView={{ strokeDasharray: finalDash, opacity: 1 }}
                  viewport={{ once: true, margin: "0px 0px -10% 0px" }}
                  transition={{ duration: 1.3, ease: EASE, delay: 0.15 + i * 0.18 }}
                />
              );
            })}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="tabular display text-5xl">2%</span>
          <span className="mt-2 text-[13px] text-muted-foreground">per trade</span>
        </div>
      </div>

      <SplitLegend />
    </figure>
  );
}
