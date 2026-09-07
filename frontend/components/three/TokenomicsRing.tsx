"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { FeeDonut, SplitLegend } from "@/components/FeeDonut";
import { supportsWebGL } from "@/lib/three/support";

const SplitRing = dynamic(() => import("./SplitRing").then((m) => m.SplitRing), {
  ssr: false,
  loading: () => <div className="aspect-square w-full" aria-hidden />,
});

/** 3D fee ring with the SVG donut as its no-WebGL fallback. */
export function TokenomicsRing() {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setSupported(supportsWebGL());
  }, []);

  if (supported === false) return <FeeDonut />;

  return (
    <figure className="flex w-full flex-col items-center gap-10">
      <div className="relative w-full max-w-[400px]">
        <div className="aspect-square w-full">{supported && <SplitRing />}</div>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="tabular display text-5xl">2%</span>
          <span className="mt-2 text-[13px] text-muted-foreground">per trade</span>
        </div>
      </div>
      <SplitLegend />
    </figure>
  );
}
