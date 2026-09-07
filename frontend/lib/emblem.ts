/*
  The NVID emblem: a ribbon that spirals into an eye.

  Procedural, so one outline feeds both the 3D extrusion in the hero and the
  2D glyph used across the UI. It is evocative of NVIDIA's mark by shape and
  colour only — it is not the registered logo. If you hold a licence to use
  the real vector, paste its SVG path data into CUSTOM_EMBLEM_PATH and both
  renderers switch to it.
*/

export const CUSTOM_EMBLEM_PATH: string | null = null;

export interface EmblemOptions {
  /** Revolutions the ribbon makes before it stops in the pupil. */
  turns: number;
  /** Where the outer tail starts, in radians (π = far left). */
  startAngle: number;
  outerRadius: number;
  innerRadius: number;
  /** Ribbon width at the tail and at the tip. */
  outerWidth: number;
  innerWidth: number;
  /** Vertical scale; below 1 squashes the circle into an almond. */
  squash: number;
  samples: number;
}

export const DEFAULT_EMBLEM: EmblemOptions = {
  turns: 1.62,
  startAngle: Math.PI * 1.04,
  outerRadius: 1,
  innerRadius: 0.3,
  outerWidth: 0.27,
  innerWidth: 0.14,
  squash: 0.58,
  samples: 180,
};

export type Point = [number, number];

const CAP_STEPS = 10;

/** Closed outline of the ribbon, counter-clockwise, in a ~[-1.15, 1.15] box. */
export function emblemOutline(o: EmblemOptions = DEFAULT_EMBLEM): Point[] {
  const centers: Point[] = [];
  const widths: number[] = [];
  const ease = (t: number) => 1 - Math.pow(1 - t, 1.7);

  for (let i = 0; i <= o.samples; i++) {
    const t = i / o.samples;
    const theta = o.startAngle - t * o.turns * Math.PI * 2; // clockwise
    const r = o.outerRadius + (o.innerRadius - o.outerRadius) * ease(t);
    centers.push([r * Math.cos(theta), r * Math.sin(theta) * o.squash]);
    widths.push(o.outerWidth + (o.innerWidth - o.outerWidth) * t);
  }

  const n = centers.length - 1;
  const normals: Point[] = centers.map((_, i) => {
    const p = centers[Math.max(i - 1, 0)];
    const q = centers[Math.min(i + 1, n)];
    const tx = q[0] - p[0];
    const ty = q[1] - p[1];
    const len = Math.hypot(tx, ty) || 1;
    return [-ty / len, tx / len];
  });

  const left: Point[] = centers.map((c, i) => [c[0] + (normals[i][0] * widths[i]) / 2, c[1] + (normals[i][1] * widths[i]) / 2]);
  const right: Point[] = centers.map((c, i) => [c[0] - (normals[i][0] * widths[i]) / 2, c[1] - (normals[i][1] * widths[i]) / 2]);

  const cap = (index: number, from: number, to: number): Point[] => {
    const [cx, cy] = centers[index];
    const radius = widths[index] / 2;
    const pts: Point[] = [];
    for (let s = 1; s < CAP_STEPS; s++) {
      const a = from + (to - from) * (s / CAP_STEPS);
      pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
    }
    return pts;
  };

  const angleOf = ([x, y]: Point) => Math.atan2(y, x);
  const endNormal = angleOf(normals[n]);
  const startNormal = angleOf(normals[0]);

  return [
    ...left,
    ...cap(n, endNormal, endNormal - Math.PI), // round tip
    ...right.reverse(),
    ...cap(0, startNormal + Math.PI, startNormal), // round tail
  ];
}

/** The outline as SVG path data inside a 100 × 100 viewBox. */
export function emblemSvgPath(o: EmblemOptions = DEFAULT_EMBLEM, size = 100): string {
  if (CUSTOM_EMBLEM_PATH) return CUSTOM_EMBLEM_PATH;
  const pts = emblemOutline(o);
  // Fit the outline's bounding box into 90% of the viewBox, centred.
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = (size * 0.9) / Math.max(maxX - minX, maxY - minY);
  const cx = size / 2 - ((minX + maxX) / 2) * scale;
  const cy = size / 2 + ((minY + maxY) / 2) * scale;
  const fmt = (v: number) => v.toFixed(2).replace(/\.?0+$/, "");
  return (
    pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${fmt(cx + x * scale)} ${fmt(cy - y * scale)}`)
      .join("") + "Z"
  );
}
