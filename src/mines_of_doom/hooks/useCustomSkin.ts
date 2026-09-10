import { useMemo, useRef } from "react";
import { useLocalStorage } from "hooks/useLocalStorage";
import {
 CustomSkinGrid,
 CustomSkinSave,
 defaultCustomSkin,
 normalizeCustomSkinAudio,
 normalizeCustomSkinGrid,
 normalizeCustomSkinSave,
} from "../customSkin";

/**
 * Custom-skin state (docs/todo.md custom-skinning line): the device-local
 * slot lives in its own AsyncStorage key — NOT in the SaveData model — so
 * an uploaded sprite/sound never rides save-code imports or cloud restores
 * and never inflates the save blob (the same device-local reasoning as IAP
 * entitlements). The raw stored value is normalized on every render
 * (cheap: 256 cells max), so a hand-edited or corrupt slot degrades to a
 * locked, empty skin instead of crashing the sprite or audio layers.
 */
const CUSTOM_SKIN_KEY = "customSkin";

export interface UseCustomSkin {
 /** The normalized slot. */
 skin: CustomSkinSave;
 /**
  * Unlock the one-time gate (IAP grant path). Idempotent: it only adds
  * `unlocked` and never touches the player's uploads, so re-running it
  * after an import/reset re-grants at no cost (the pass belongs to the
  * player, not to one save).
  */
 unlock(): void;
 /** Toggle the appearance. */
 setEquipped(equipped: boolean): void;
 /**
  * Store an uploaded 16×16 body (re-validated defensively) and equip the
  * skin on first upload. A no-op when the slot is still locked or the
  * grid fails validation (the picker already rejected it; this guards
  * the programmatic path).
  */
 setGrid(grid: CustomSkinGrid | null): void;
 /** Store (or clear, with null) the uploaded swing sound data URI. */
 setAudio(uri: string | null): void;
 /** Clear the player's uploads (keeps the unlock — that's a purchase). */
 clear(): void;
}

export function useCustomSkin(): UseCustomSkin {
 const [raw, setRaw] = useLocalStorage<unknown>(
  CUSTOM_SKIN_KEY,
  defaultCustomSkin(),
 );
 // Normalized view: stable per stored value (the raw ref only changes on
 // load/write, never on the 1s tick).
 const skin = useMemo(() => normalizeCustomSkinSave(raw), [raw]);
 // The setter takes a VALUE (useLocalStorage has no functional updates),
 // so actions build on the latest normalized value via a ref.
 const rawRef = useRef(raw);
 rawRef.current = raw;
 const skinRef = useRef(skin);
 skinRef.current = skin;

 const update = (fn: (current: CustomSkinSave) => CustomSkinSave): void => {
  setRaw(fn(skinRef.current));
 };

 const unlock = (): void => {
  const current = skinRef.current;
  if (current.unlocked) {
   return;
  }
  update((c) => ({ ...c, unlocked: true }));
 };

 const setEquipped = (equipped: boolean): void => {
  const current = skinRef.current;
  if (current.equipped === equipped) {
   return;
  }
  update((c) => ({ ...c, equipped }));
 };

 const setGrid = (grid: CustomSkinGrid | null): void => {
  const current = skinRef.current;
  if (!current.unlocked) {
   return;
  }
  const normalized = grid == null ? null : normalizeCustomSkinGrid(grid);
  if (normalized == null && grid != null) {
   return;
  }
  update((c) => ({
   ...c,
   grid: normalized,
   // First upload equips the skin so the player sees their pixel right
   // away (the body sprite still shows through until pixels land).
   equipped: grid == null ? c.equipped : true,
  }));
 };

 const setAudio = (uri: string | null): void => {
  const normalized = normalizeCustomSkinAudio(uri);
  update((c) => ({ ...c, audio: normalized }));
 };

 const clear = (): void => {
  const current = skinRef.current;
  if (current.grid == null && current.audio == null) {
   return;
  }
  update((c) => ({ ...c, grid: null, audio: null }));
 };

 return { skin, unlock, setEquipped, setGrid, setAudio, clear };
}
