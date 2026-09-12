import { createContext } from "react";

export type Props = {
 /**
  * Shared per-tick callback registry — the ref-array + Context pattern
  * (plan §3.2, documented here per the plan).
  *
  * `onTick` is a plain mutable array owned by the game engine
  * (`useGameEngine` keeps it in a ref). Components that should animate
  * once per game tick — today, the `Miner` sprites with `reactOnTick`
  * — PUSH their callback into the array on mount and SPlice it out on
  * unmount (see `Miner.tsx`). The engine's 1Hz loop calls every
  * registered callback exactly once per tick — but only while passive
  * income is non-zero: the loop fires the registry exclusively inside the
  * miners-gate (and only after the `elapsed < 1` early return), so a
  * zero-miner session gets no callbacks at all (F40.1). Don't register
  * deadline-dependent work here — poll a wall-clock deadline, like the
  * other pollers do.
  *
  * Why a mutable ref array in a Context instead of React state/props?
  * - The registry is mutated imperatively on mount/unmount. Routing it
  *   through state or props would re-render the whole tree (every
  *   Miner) just to propagate one callback.
  * - The context value is the array itself: `onTick.current` has stable
  *   identity (the engine never replaces the array), and the value is
  *   memoized in `MinesOfDoom.tsx`, so consumers only re-render if that
  *   identity ever changed — it doesn't.
  *
  * Trade-off (deliberate): this bypasses React's data-flow rules. The
  * only correct usage is push-on-mount / splice-on-unmount, and nothing
  * should assume the array is frozen or read it across renders for
  * anything other than iteration by the tick loop.
  */
 onTick: Array<() => void>;
};
// SAFETY: the null default is unreachable — the app always provides the
// real context from MinesOfDoom, so consumers only ever see a non-null
// Props; the assertion just satisfies createContext's generic.
export const Context = createContext<Props>(null as unknown as Props);
