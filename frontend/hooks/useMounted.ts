"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True after hydration. Server snapshot is false, so wallet-dependent UI never mismatches. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
