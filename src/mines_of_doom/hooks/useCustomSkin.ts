import { useMemo, useRef } from "react";
import { useLocalStorage } from "hooks/useLocalStorage";
import {
 CustomSkinGrid,
 CustomSkinSave,
 defaultCustomSkin,
 normalizeCustomSkinArtId,
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
 /**
  * Store an uploaded 16×16 pickaxe sprite (full-sprite override of the
  * equipped pickaxe — the swing/wind-up frames are CSS rotations of the
  * one sprite, so a single image covers every frame). Re-validated
  * defensively; a no-op when the slot is still locked or the grid fails
  * validation. First upload equips the skin (same rule as setGrid).
  */
 setPickaxeGrid(grid: CustomSkinGrid | null): void;
 /** Store (or clear, with null) the uploaded swing sound data URI. */
 setAudio(uri: string | null): void;
 /**
  * Equip a bundled sprite-library id (bundledSprites.ts) as the body
  * art — or null to fall back to the generated pixel look. Picking an
  * art IS equipping it (same first-upload-equip rule as setGrid). A
  * no-op when the slot is still locked or the id is not in the library.
  */
 setArt(id: string | null): void;
 /** Clear only the uploaded pickaxe sprite (body art + audio stay). */
 clearPickaxe(): void;
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
   // A fresh image upload supersedes a bundled sprite (most recent
   // intent wins the single body-art slot).
   artId: grid == null ? c.artId : null,
   // First upload equips the skin so the player sees their pixel right
   // away (the body sprite still shows through until pixels land).
   equipped: grid == null ? c.equipped : true,
  }));
 };

 const setPickaxeGrid = (grid: CustomSkinGrid | null): void => {
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
   pickaxeGrid: normalized,
   // First pickaxe upload equips the skin so the player sees their
   // sprite right away (the stock pickaxe shows through until pixels
   // land) — same first-upload-equip rule as setGrid.
   equipped: grid == null ? c.equipped : true,
  }));
 };

 const setArt = (id: string | null): void => {
  const current = skinRef.current;
  if (!current.unlocked) {
   return;
  }
  const normalized = id == null ? null : normalizeCustomSkinArtId(id);
  if (normalized == null && id != null) {
   return; // unknown library id — keep the slot clean
  }
  update((c) => ({
   ...c,
   artId: normalized,
   // Picking a bundled sprite equips the skin right away (same rule
   // as a first image upload) — null ("default look") keeps whatever
   // the current equipped state is.
   equipped: id == null ? c.equipped : true,
  }));
 };

 const setAudio = (uri: string | null): void => {
  const normalized = normalizeCustomSkinAudio(uri);
  update((c) => ({ ...c, audio: normalized }));
 };

 const clearPickaxe = (): void => {
  setPickaxeGrid(null);
 };

 const clear = (): void => {
  const current = skinRef.current;
  if (
   current.grid == null &&
   current.artId == null &&
   current.audio == null &&
   current.pickaxeGrid == null
  ) {
   return;
  }
  update((c) => ({ ...c, grid: null, artId: null, audio: null, pickaxeGrid: null }));
 };

 return {
  skin,
  unlock,
  setEquipped,
  setGrid,
  setPickaxeGrid,
  setAudio,
  setArt,
  clearPickaxe,
  clear,
 };
}
