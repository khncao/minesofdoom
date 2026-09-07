import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "src/hooks/useI18n";
import {
  GemPocket,
  isPocketExpired,
  pocketCooldownUntil,
  rollPocketSpawn,
} from "../gemPocket";

const CHECK_MS = 1000;

/**
 * Gem pocket (gemPocket.ts): the rare in-cave bonus node while the game
 * is open. Mirrors the useDailyBonus patterns: pure decision logic lives
 * in gemPocket.ts, this hook owns the 1s check loop and the
 * collect-once ref guard (setState is render-late, so the ref is the
 * source of truth a fast second tap must see).
 *
 * `clickPower` is the player's CURRENT effective click power (bigint,
 * like effectiveClickPower on the main screen) — the bonus is computed
 * at spawn from whatever value is live then.
 */
export function useGemPocket({
  enabled,
  clickPower,
  grantMinerals,
  displayMessage,
  onCollected,
}: {
  /** False while the onboarding overlay is up: no spawns or toasts
   *  behind the first-run screen (existing pockets still expire). */
  enabled: boolean;
  clickPower: bigint;
  /** The engine's additive mineral callback (addTapGain): the bonus flows
   *  through the same lifetime-stats path as any other gain. */
  grantMinerals: (minerals: bigint) => void;
  displayMessage: (message: string, timeout: number) => void;
  /** Fired on a successful collect, before the state clears. */
  onCollected?: (bonus: number) => void;
}) {
  const { t } = useI18n();
  // Ephemeral on purpose (see gemPocket.ts): never persisted.
  const [pocket, setPocket] = useState<GemPocket | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const pocketRef = useRef<GemPocket | null>(pocket);
  pocketRef.current = pocket;
  const cooldownRef = useRef(cooldownUntil);
  cooldownRef.current = cooldownUntil;
  const powerRef = useRef(clickPower);
  powerRef.current = clickPower;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const grantRef = useRef(grantMinerals);
  grantRef.current = grantMinerals;
  const onCollectedRef = useRef(onCollected);
  onCollectedRef.current = onCollected;
  const spawnNotifyRef = useRef<() => void>(() => {});
  spawnNotifyRef.current = () => {
    // A toast, not a persistent overlay — never covers the screen.
    displayMessage(t("toast.gemPocket"), 3000);
  };

  // 1s check loop: expire the live pocket, then roll a spawn. Date.now()
  // inside the interval keeps this honest across backgrounded time —
  // a pocket formed before a long sleep is expired on the first wake
  // check, which is the real (non-fake) window behaving correctly.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const active = pocketRef.current;
      if (active != null) {
        if (isPocketExpired(active, now)) {
          const cooldown = pocketCooldownUntil(active);
          pocketRef.current = null;
          cooldownRef.current = cooldown;
          setPocket(null);
          setCooldownUntil(cooldown);
        }
        return;
      }
      if (!enabledRef.current) return;
      const spawned = rollPocketSpawn(
        {
          now,
          active: null,
          cooldownUntil: cooldownRef.current,
          clickPower: powerRef.current,
        },
        Math.random,
      );
      if (spawned != null) {
        pocketRef.current = spawned;
        setPocket(spawned);
        spawnNotifyRef.current();
      }
    }, CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const collect = useCallback(() => {
    const active = pocketRef.current;
    if (active == null) return;
    if (isPocketExpired(active, Date.now())) {
      // Lost the race with the expiry tick — the window is real, it paid
      // nothing. Clear it and start the cooldown honestly.
      pocketRef.current = null;
      const cooldown = pocketCooldownUntil(active);
      cooldownRef.current = cooldown;
      setPocket(null);
      setCooldownUntil(cooldown);
      return;
    }
    // Publish the clear to the ref synchronously: a fast second tap
    // before the render lands must not pay the bonus twice.
    pocketRef.current = null;
    const cooldown = pocketCooldownUntil(active);
    cooldownRef.current = cooldown;
    setPocket(null);
    setCooldownUntil(cooldown);
    grantRef.current(BigInt(active.bonus));
    onCollectedRef.current?.(active.bonus);
  }, []);

  return { pocket, collect };
}
