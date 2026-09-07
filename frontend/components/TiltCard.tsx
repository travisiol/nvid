"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, type MotionStyle } from "framer-motion";
import type { PointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Maximum tilt in degrees. */
  max?: number;
}

/**
 * Gives a card a little physical depth: it tilts a few degrees toward the
 * pointer and a soft green sheen follows the cursor. Static under
 * prefers-reduced-motion.
 */
export function TiltCard({ children, className, max = 4 }: TiltCardProps) {
  const reduce = useReducedMotion();

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const sheenX = useMotionValue(50);
  const sheenY = useMotionValue(50);
  const springX = useSpring(rotateX, { stiffness: 170, damping: 22, mass: 0.6 });
  const springY = useSpring(rotateY, { stiffness: 170, damping: 22, mass: 0.6 });
  const sheen = useMotionTemplate`${sheenX}% ${sheenY}%`;

  if (reduce) {
    return <div className={cn("relative", className)}>{children}</div>;
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 2 * max);
    rotateX.set(-(py - 0.5) * 2 * max);
    sheenX.set(px * 100);
    sheenY.set(py * 100);
  };

  const onPointerLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    sheenX.set(50);
    sheenY.set(50);
  };

  const style = {
    rotateX: springX,
    rotateY: springY,
    transformPerspective: 1000,
    "--sheen": sheen,
  } as unknown as MotionStyle;

  return (
    <motion.div
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={style}
      className={cn("group/tilt relative h-full will-change-transform [transform-style:preserve-3d]", className)}
    >
      {children}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/tilt:opacity-100"
        style={{
          borderRadius: "var(--radius)",
          background: "radial-gradient(340px circle at var(--sheen), rgba(118, 185, 0, 0.09), transparent 62%)",
        }}
      />
    </motion.div>
  );
}
