"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

/*
  The whole motion vocabulary of the site, in one file:
    fade up · opacity · scale 0.98 → 1 · slow stagger.
  Everything else is CSS. Respects prefers-reduced-motion by rendering static.
*/

export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const VIEWPORT = { once: true, margin: "0px 0px -10% 0px" } as const;

interface RevealProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  id?: string;
  delay?: number;
  duration?: number;
}

export function FadeUp({ children, className, style, id, delay = 0, duration = 0.9 }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div id={id} className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      id={id}
      className={className}
      style={style}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function FadeIn({ children, className, style, id, delay = 0, duration = 1.1 }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div id={id} className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      id={id}
      className={className}
      style={style}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={VIEWPORT}
      transition={{ duration, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({ children, className, style, id, delay = 0, duration = 1.1 }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div id={id} className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      id={id}
      className={className}
      style={style}
      initial={{ opacity: 0, scale: 0.98 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={VIEWPORT}
      transition={{ duration, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.85, ease: EASE } },
};

export function Stagger({ children, className, style, id }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div id={id} className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      id={id}
      className={className}
      style={style}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className, style }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <motion.div className={className} style={style} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
