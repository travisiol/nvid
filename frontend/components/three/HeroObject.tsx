"use client";

import dynamic from "next/dynamic";

/** three.js is loaded only in the browser, after hydration, and only here. */
const EyeHero = dynamic(() => import("./EyeHero").then((m) => m.EyeHero), {
  ssr: false,
  loading: () => <div className="mx-auto aspect-square w-full max-w-[560px]" aria-hidden />,
});

export function HeroObject() {
  return <EyeHero />;
}
