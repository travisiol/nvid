import { emblemSvgPath } from "@/lib/emblem";

const PATH = emblemSvgPath();

interface EyeMarkProps {
  className?: string;
  /** Accessible name. Omit for a purely decorative glyph. */
  title?: string;
}

/** The emblem as a 2D glyph. Colour comes from `currentColor`. */
export function EyeMark({ className, title }: EyeMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d={PATH} fill="currentColor" />
    </svg>
  );
}
