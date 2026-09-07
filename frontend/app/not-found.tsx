import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-svh max-w-7xl flex-col items-start justify-center gap-8 px-6 pt-20 lg:px-10">
      <span className="eyebrow">404</span>
      <h1 className="display text-4xl md:text-6xl">This page is not in the vault.</h1>
      <Button variant="outline" asChild>
        <Link href="/">Back to NVID</Link>
      </Button>
    </div>
  );
}
