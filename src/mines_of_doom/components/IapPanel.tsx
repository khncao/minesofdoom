import { memo, useMemo, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { T as Text } from "../textScale";
import BottomModal from "src/components/BottomModal";
import Button from "src/components/Button";
import { useContent, useI18n } from "src/hooks/useI18n";
import {
  IapEntitlements,
  IapPackLine,
  IapProduct,
  IapProductId,
  IAP_PACK_GRANTS,
  IAP_PRODUCT_LIST,
  getIapPackCosmetic,
  getIapProductPreview,
  isIapProductEquipped,
  isIapProductOwned,
} from "../iaps";
import {
  ROSTER_ASSIGNABLE_SLOTS,
  getPickaxe,
  rollMinerLook,
} from "../cosmetics";
import { CustomSkinSave, customSkinGridKey } from "../customSkin";
import { BUNDLED_SPRITES } from "../bundledSprites";
import { SKIN_SAMPLE_PICKAXES, SKIN_SAMPLE_SOUNDS } from "../skinSamples";
import { minerSpriteUri, pickaxeSpriteUri } from "src/utils/graphics/pixelArt";
import { emojis } from "src/utils/graphics/emojis";
import { styles } from "../styles";

/**
 * The unified shop (todo: "move gem shop cosmetics to one time purchase
 * shop with gem and cash buy options"): the SINGLE place cosmetics are
 * bought. Every catalog row (one pack per paid cosmetic, catalog order
 * per line) offers BOTH buy options:
 *  - **gems** — the in-game price (the old gem shop, moved here from the
 *    menu sheet's Shop view; the engine gem buy auto-equips);
 *  - **one-time cash** — the store pack (price label; the store's own
 *    checkout shows its localized price). Rendered only while the IAP
 *    provider is available; until the real store is live the row simply
 *    offers the gem buy, so the shop stays the free path (guardrail 1).
 * The menu sheet no longer has a Shop view: equipping and rerolling live
 * here too (the look preview row), and owned rows equip on tap.
 *
 * The panel renders ALWAYS (gem path is universal); the cash extras
 * (cash buttons, dev-store banner) are gated on `cashAvailable` =
 * provider.isAvailable(). There is no manual restore button: the useIap
 * launch-reconcile silently re-derives every completed purchase from the
 * store's own record on each launch. Copy states plainly that
 * everything is optional and the game stays fully free (guardrails 1 & 4):
 * no urgency language, no default-checked options, no misleading icons.
 *
 * Catalog layout (todo: "implement cosmetic shop with grid view cards and
 * larger previews"): pickaxes, outfits and cave themes render as a GRID of
 * cards with 2–3× larger previews; the custom-skin line keeps its control
 * rows (uploads/samples are row-shaped, cards don't fit them).
 *
 * Per-crew customization (todo: "allow visual customization (iap
 * cosmetic) of hired miners individually"): the Outfits group carries a
 * "worn by" wearer selector — 👤 You or one of the visible hired crew
 * slots (see ROSTER_ASSIGNABLE_SLOTS). Selecting a crew slot makes every
 * owned outfit card offer Wear / Revert for that hire; the free default
 * is You (equip/reroll as before). Pickaxes and cave themes always act
 * on the player.
 */
/**
 * Shop-card preview (todo: "Show cosmetic previews in shop listings" +
 * "grid view cards and larger previews"): the actual sprite / palette the
 * pack grants (getIapProductPreview) blown up to card size, so a player
 * can see the item before buying.
 */
function ProductPreview({
  productId,
  line,
  compact = false,
}: {
  productId: IapProductId;
  line: IapPackLine;
  /** Row-sized thumb (the custom-skin line's control rows). */
  compact?: boolean;
}) {
  const preview = getIapProductPreview(productId);
  if (preview.kind === "sprite") {
    return (
      <Image
        source={{ uri: preview.uri }}
        style={
          compact
            ? { width: 24, height: 24 }
            : line === "pickaxe"
              ? styles.shopPickaxePreview
              : styles.shopOutfitPreview
        }
        accessibilityRole="image"
      />
    );
  }
  if (preview.kind === "swatches") {
    return (
      <View style={{ flexDirection: "row", gap: 3, alignItems: "flex-end" }}>
        {preview.tints.map((tint, i) => (
          <View
            key={i}
            style={{
              width: 10,
              height: 16 + i * 6,
              borderRadius: 3,
              backgroundColor: tint,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </View>
    );
  }
  return null;
}

/** The "worn by" selector chip (per-crew customization): a wearer target
 *  for outfit assignments — the player, or one hired crew slot. */
function WearerChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? "#ffd54f" : "rgba(255,255,255,0.35)",
        backgroundColor: active ? "rgba(255,213,79,0.18)" : "rgba(0,0,0,0.3)",
      }}
    >
      <Text
        style={{
          ...styles.text,
          fontSize: 12,
          fontWeight: active ? "bold" : "normal",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function IapPanel({
  isDevSim,
  isDevBuild,
  realStoreIap,
  onRealStoreChange,
  cashAvailable,
  gems,
  playerSeed,
  selectedOutfit,
  selectedPickaxe,
  selectedCaveTheme,
  /** Hired normal crew count — the individually-customizable roster slots. */
  miners,
  /**
   * Owned-filtered per-crew outfit overrides (the engine's minerOutfits
   * filtered by the caller to owned ids): roster slot decimal string →
   * outfit id. A slot without an override wears the player's selection.
   */
  minerOutfits,
  purchasing,
  entitlements,
  saveOwnedCosmeticIds,
  themesLocked,
  customSkin,
  onBuyGems,
  onPurchase,
  onSelect,
  onAssignMinerOutfit,
  onClearMinerOutfit,
  onReroll,
  onUploadSkinImage,
  onUploadSkinPickaxe,
  onUploadSkinAudio,
  onPickBundledSprite,
  onPickSkinSamplePickaxe,
  onPickSkinSampleSound,
  onClearSkin,
  onClearSkinPickaxe,
}: {
  /** Provider is the dev simulation (dev builds only). */
  isDevSim: boolean;
  /** `__DEV__` — dev builds get the banner block + the real-store toggle. */
  isDevBuild: boolean;
  /** The persisted real-store opt-in value (IapPanel only, dev builds). */
  realStoreIap: boolean;
  /** Present on native dev builds (web has no store billing): flips the
   *  real-store opt-in. Absent → the toggle row is not rendered. */
  onRealStoreChange?: (value: boolean) => void;
  /** `provider.isAvailable()` — the cash buy option and the dev-store
   *  banner render only while a store can complete a purchase (the gem
   *  buy is always available). */
  cashAvailable: boolean;
  /** The gem wallet — sizes the gem buttons' disabled state. */
  gems: number;
  /** The player look for the preview row (sprites come from the same
   *  pipeline as the in-game sprites). */
  playerSeed: number;
  selectedOutfit: string;
  selectedPickaxe: string;
  selectedCaveTheme: string;
  /** Hired normal crew count (per-crew customization scope). */
  miners: number;
  /** Owned-filtered per-crew outfit overrides (see the prop doc above). */
  minerOutfits: Record<string, string>;
  purchasing: IapProductId | null;
  /** This device's store entitlements (the cash-buy record). */
  entitlements: IapEntitlements;
  /** Cosmetic/theme ids the current save already owns (any source). */
  saveOwnedCosmeticIds: string[];
  /** Tier-4 goal unlock (goals.ts): the GEM buy of cave themes stays
   *  locked until Crystal Kingdom (visible-but-locked rule, as the old
   *  gem shop enforced); the cash packs are store products and stay
   *  offerable as before. */
  themesLocked: boolean;
  /**
   * The device-local custom-skin slot (useCustomSkin) — the packSkin row
   * joins its unlock/equip flags (the grant is not a save field) and its
   * uploads power the upload/clear controls below the row.
   */
  customSkin: CustomSkinSave;
  /** Web-only (for now): store an uploaded 16×16 body image. */
  onUploadSkinImage?: () => void;
  /**
   * Web-only (for now): store an uploaded 16×16 pickaxe sprite (the
   * pickaxe slot) — full-sprite override of the player's pickaxe.
   */
  onUploadSkinPickaxe?: () => void;
  /** Web-only (for now): store an uploaded swing sound. */
  onUploadSkinAudio?: () => void;
  /**
   * Tap-to-equip a ready-made sample pickaxe sprite (skinSamples.ts) —
   * fills the pickaxe slot with the same 16×16 grid shape an upload
   * decodes to. Offered on any platform (no files needed).
   */
  onPickSkinSamplePickaxe?: (id: string) => void;
  /**
   * Tap-to-equip a ready-made sample swing sound (skinSamples.ts) —
   * fills the audio slot with the same WAV data-URI shape an upload
   * stores. Offered on any platform (no files needed).
   */
  onPickSkinSampleSound?: (id: string) => void;
  /**
   * Pick a bundled sprite-library art (bundledSprites.ts) as the body —
   * null reverts to the default generated pixel look. Only offered once
   * the skin line is unlocked (the same gate as the uploads).
   */
  onPickBundledSprite?: (id: string | null) => void;
  /** Clear the player's skin uploads (keeps the unlock). */
  onClearSkin?: () => void;
  /** Clear only the uploaded pickaxe sprite (body art + audio stay). */
  onClearSkinPickaxe?: () => void;
  /** The engine gem buy (auto-equips; idempotent, no-op when unaffordable). */
  onBuyGems: (id: IapProductId) => void;
  /** The store purchase (provider flow). */
  onPurchase: (id: IapProductId) => void;
  /** Equip an owned cosmetic/theme (the save's select action). */
  onSelect: (id: IapProductId) => void;
  /** Assign an OWNED outfit to a hired miner slot (free; no-op if the
   *  slot is out of range or the outfit isn't owned). */
  onAssignMinerOutfit: (slot: number, outfitId: string) => void;
  /** Revert a hired miner slot to the player's selected outfit. */
  onClearMinerOutfit: (slot: number) => void;
  /** The seeded "reroll look" randomizer. */
  onReroll: () => void;
}) {
  const { t } = useI18n();
  const content = useContent();

  // Per-crew customization wearer (todo: "allow visual customization (iap
  // cosmetic) of hired miners individually"): -1 = the player; 0…hired-1 =
  // the visible crew slots. Outfit cards act on this wearer; pickaxes and
  // cave themes always act on the player. Defaults to the player; a slot
  // beyond the current crew is never offered.
  const [wearer, setWearer] = useState(-1);
  const hiredSlots = Math.max(0, Math.min(miners, ROSTER_ASSIGNABLE_SLOTS));

  const playerUri = useMemo(
    () => minerSpriteUri(rollMinerLook(playerSeed, selectedOutfit)),
    [playerSeed, selectedOutfit],
  );
  const playerPickaxeUri = useMemo(
    () => pickaxeSpriteUri(getPickaxe(selectedPickaxe).theme),
    [selectedPickaxe],
  );

  /** Grid card for a pickaxe / outfit / cave-theme product (todo:
   *  "cosmetic shop with grid view cards and larger previews"). Outfit
   *  cards act on the selected wearer (You = equip, crew slot = assign);
   *  pickaxes/themes act on the player as before. */
  const renderCard = (product: IapProduct) => {
    const text = content("iap", product.id, {
      title: product.label,
      detail: product.blurb,
    });
    const grant = getIapPackCosmetic(product.id);
    const owned = isIapProductOwned(
      product.id,
      entitlements,
      saveOwnedCosmeticIds,
      customSkin.unlocked,
    );
    const gemsAffordable = gems >= grant.costGems;
    const gemLocked = product.line === "caveTheme" && themesLocked;
    const isOutfit = product.line === "outfit";
    // The granted cosmetic id (the wearer comparison + the assign target).
    const outfitId = IAP_PACK_GRANTS[product.id].id;
    // Equipped state depends on the wearer for outfit cards: the player's
    // selection, or the selected crew slot's override ("worn by"). The
    // owned-only filter on `minerOutfits` means a stale (not-owned)
    // override never reads as worn here — same fallback as the renderer.
    let equipped = false;
    let wornBySelected = false;
    if (isOutfit && wearer >= 0) {
      wornBySelected = minerOutfits[String(wearer)] === outfitId;
      equipped = wornBySelected;
    } else {
      equipped = isIapProductEquipped(
        product.id,
        selectedOutfit,
        selectedPickaxe,
        selectedCaveTheme,
        customSkin.equipped,
      );
    }
    return (
      <View key={product.id} style={styles.shopCard}>
        <View style={styles.shopCardPreview}>
          <ProductPreview productId={product.id} line={product.line} />
        </View>
        <Text style={styles.shopCardTitle} numberOfLines={2}>
          {text.title}
          {owned ? " ✓" : ""}
        </Text>
        {owned ? (
          <View style={{ alignItems: "center", gap: 4, alignSelf: "stretch" }}>
            <Button
              tone="gem"
              disabled={equipped}
              title={
                equipped
                  ? isOutfit && wearer >= 0
                    ? t("iap.worn")
                    : t("iap.equipped")
                  : isOutfit && wearer >= 0
                    ? t("iap.wear")
                    : t("iap.equip")
              }
              onPress={() => {
                if (isOutfit && wearer >= 0) {
                  onAssignMinerOutfit(wearer, outfitId);
                } else {
                  onSelect(product.id);
                }
              }}
            />
            {wornBySelected && (
              <Button
                title={t("iap.revert")}
                onPress={() => onClearMinerOutfit(wearer)}
              />
            )}
          </View>
        ) : (
          <View style={{ gap: 4, alignSelf: "stretch" }}>
            <Button
              tone="gem"
              disabled={!gemsAffordable || gemLocked || purchasing != null}
              title={`${grant.costGems} ${emojis.gem}`}
              onPress={() => onBuyGems(product.id)}
            />
            {cashAvailable && (
              <Button
                disabled={purchasing != null}
                title={purchasing === product.id ? "…" : product.priceLabel}
                onPress={() => onPurchase(product.id)}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  /** The custom-skin line keeps its control ROWS (uploads/samples are
   *  row-shaped; cards don't fit them) — the pre-grid row layout. */
  const renderSkinRow = (product: IapProduct) => {
    const text = content("iap", product.id, {
      title: product.label,
      detail: product.blurb,
    });
    const pack = getIapPackCosmetic(product.id);
    const owned = isIapProductOwned(
      product.id,
      entitlements,
      saveOwnedCosmeticIds,
      customSkin.unlocked,
    );
    const equipped = isIapProductEquipped(
      product.id,
      selectedOutfit,
      selectedPickaxe,
      selectedCaveTheme,
      customSkin.equipped,
    );
    const gemsAffordable = gems >= pack.costGems;
    return (
      <View
        key={product.id}
        style={{ ...styles.flexCenteredRow, gap: 6, alignItems: "flex-start" }}
      >
        <ProductPreview
          productId={product.id}
          line={product.line}
          compact
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.text}>
            {text.title}
            {owned ? " ✓" : ""}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
            {text.detail ?? product.blurb}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
            {t("iap.oneTime", { price: product.priceLabel })}
          </Text>
          <Text style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}>
            {t("iap.alsoEarnable", { count: pack.costGems })}
          </Text>
        </View>
        {owned ? (
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Button
              tone="gem"
              disabled={equipped}
              title={equipped ? t("iap.equipped") : t("iap.equip")}
              onPress={() => onSelect(product.id)}
            />
            {/* The custom-skin row: upload controls (both platforms) +
                clear — the slot is device-local, uploads live in the
                customSkin save slot, not the game save. */}
            <>
              {onUploadSkinImage != null ? (
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <Button
                    tone="gem"
                    title={t("iap.skinUploadImage")}
                    onPress={onUploadSkinImage}
                  />
                  {onUploadSkinAudio != null && (
                    <Button
                      tone="gem"
                      title={t("iap.skinUploadAudio")}
                      onPress={onUploadSkinAudio}
                    />
                  )}
                </View>
              ) : (
                <Text style={{ ...styles.text, fontSize: 10, opacity: 0.7 }}>
                  {t("iap.skinUploadsUnavailable")}
                </Text>
              )}
              {/* The sample swing sounds (skinSamples.ts — todo: "add a
                  few sample sprites and sounds to custom skin iap"):
                  tap-to-equip ready-made clips — the same WAV data-URI
                  shape an upload stores, no files needed. The active
                  row highlight mirrors the sprite library below. */}
              {SKIN_SAMPLE_SOUNDS.length > 0 &&
                onPickSkinSampleSound != null && (
                  <View style={{ gap: 3 }}>
                    <Text
                      style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}
                    >
                      {t("iap.skinSoundSamples")}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 4,
                      }}
                    >
                      {SKIN_SAMPLE_SOUNDS.map((s) => {
                        const active = customSkin.audio === s.uri;
                        return (
                          <Pressable
                            key={s.id}
                            testID={`skin-sample-sound-${s.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={
                              content("skinSample", s.id, { title: s.name })
                                .title
                            }
                            onPress={() => onPickSkinSampleSound(s.id)}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 4,
                              borderWidth: active ? 2 : 1,
                              borderColor: active
                                ? "#ffd54f"
                                : "rgba(255,255,255,0.3)",
                              backgroundColor: "rgba(0,0,0,0.25)",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text style={{ fontSize: 16 }}>{s.glyph}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              {/* The bundled sprite library (bundledSprites.ts — CC0
                  2D art, see public/assets/sprites/CREDITS.txt): pick
                  a ready-made body, or the default generated look. */}
              {onPickBundledSprite != null && (
                <View style={{ gap: 3 }}>
                  <Text
                    style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}
                  >
                    {t("iap.skinSprites")}
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 4,
                    }}
                  >
                    <Pressable
                      testID="skin-sprite-default"
                      accessibilityRole="button"
                      accessibilityLabel={t("iap.skinSpriteDefault")}
                      onPress={() => onPickBundledSprite(null)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 4,
                        borderWidth: 1,
                        borderColor:
                          customSkin.artId == null
                            ? "#ffd54f"
                            : "rgba(255,255,255,0.3)",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(0,0,0,0.25)",
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>⛏️</Text>
                    </Pressable>
                    {BUNDLED_SPRITES.map((s) => {
                      const active = customSkin.artId === s.id;
                      return (
                        <Pressable
                          key={s.id}
                          testID={`skin-sprite-${s.id}`}
                          accessibilityRole="button"
                          accessibilityLabel={
                            content("bundledSprite", s.id, {
                              title: s.name,
                            }).title
                          }
                          onPress={() => onPickBundledSprite(s.id)}
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 4,
                            borderWidth: active ? 2 : 1,
                            borderColor: active
                              ? "#ffd54f"
                              : "rgba(255,255,255,0.3)",
                            backgroundColor: "rgba(0,0,0,0.25)",
                          }}
                        >
                          <Image
                            source={{ uri: s.uri }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="contain"
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
              {/* The pickaxe slot (todo: "Custom skin generator —
                  pickaxe slot"): a 16×16 upload replaces the player's
                  pickaxe sprite — full-sprite override (the
                  swing/wind-up frames rotate the one image, so it
                  covers every frame). The sample row below is the
                  ready-made set (skinSamples.ts — todo: "add a few
                  sample sprites…"): tap-to-equip grids of the same
                  16×16 shape an upload decodes to, no files needed. */}
              {onUploadSkinPickaxe != null && (
                <View style={{ gap: 3 }}>
                  <Text
                    style={{ ...styles.text, fontSize: 11, opacity: 0.7 }}
                  >
                    {t("iap.skinPickaxe")}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <Button
                      tone="gem"
                      title={t("iap.skinUploadPickaxe")}
                      onPress={onUploadSkinPickaxe}
                    />
                    {customSkin.pickaxeGrid != null &&
                      onClearSkinPickaxe != null && (
                        <Button
                          tone="gem"
                          title={t("iap.skinClearPickaxe")}
                          onPress={onClearSkinPickaxe}
                        />
                      )}
                  </View>
                  {SKIN_SAMPLE_PICKAXES.length > 0 &&
                    onPickSkinSamplePickaxe != null && (
                      <View style={{ gap: 3 }}>
                        <Text
                          style={{
                            ...styles.text,
                            fontSize: 11,
                            opacity: 0.7,
                          }}
                        >
                          {t("iap.skinPickaxeSamples")}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: 4,
                          }}
                        >
                          {SKIN_SAMPLE_PICKAXES.map((s) => {
                            const active =
                              customSkin.pickaxeGrid != null &&
                              customSkinGridKey(customSkin.pickaxeGrid) ===
                                customSkinGridKey(s.grid);
                            return (
                              <Pressable
                                key={s.id}
                                testID={`skin-sample-pickaxe-${s.id}`}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  content("skinSample", s.id, {
                                    title: s.name,
                                  }).title
                                }
                                onPress={() => onPickSkinSamplePickaxe(s.id)}
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 4,
                                  borderWidth: active ? 2 : 1,
                                  borderColor: active
                                    ? "#ffd54f"
                                    : "rgba(255,255,255,0.3)",
                                  backgroundColor: "rgba(0,0,0,0.25)",
                                }}
                              >
                                <Image
                                  source={{ uri: s.uri }}
                                  style={{ width: "100%", height: "100%" }}
                                  resizeMode="contain"
                                />
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}
                </View>
              )}
              {(customSkin.grid != null ||
                customSkin.artId != null ||
                customSkin.audio != null ||
                customSkin.pickaxeGrid != null) &&
                onClearSkin != null && (
                  <Button
                    tone="gem"
                    title={t("iap.skinClear")}
                    onPress={onClearSkin}
                  />
                )}
            </>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 4 }}>
            <Button
              tone="gem"
              disabled={!gemsAffordable || purchasing != null}
              title={`${pack.costGems} ${emojis.gem}`}
              onPress={() => onBuyGems(product.id)}
            />
            {cashAvailable && (
              <Button
                disabled={purchasing != null}
                title={purchasing === product.id ? "…" : product.priceLabel}
                onPress={() => onPurchase(product.id)}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  const GROUP_ORDER: IapPackLine[] = ["pickaxe", "outfit", "caveTheme", "skin"];

  return (
    <BottomModal
      pressable={<Text style={{ fontSize: 30 }}>🛍️</Text>}
      accessibilityLabel={t("iap.a11y")}
      scrollable
    >
      <View style={{ gap: 8, padding: 4 }}>
        <Text style={styles.text}>{t("iap.title")}</Text>
        {cashAvailable && isDevSim && (
          <Text style={{ ...styles.text, color: "#ffaa44" }}>
            {t("iap.devSim")}
          </Text>
        )}
        {cashAvailable && isDevBuild && !isDevSim && (
          // Dev build running the REAL provider (real-store opt-in on):
          // say so plainly (transparency guardrail) — this device hits
          // the real store.
          <Text style={{ ...styles.text, color: "#ffaa44" }}>
            {t("iap.devRealStoreActive")}
          </Text>
        )}
        {cashAvailable && isDevBuild && onRealStoreChange != null && (
          <Pressable
            accessibilityRole="button"
            onPress={() => onRealStoreChange(!realStoreIap)}
            style={{ padding: 4 }}
          >
            <Text style={{ ...styles.text, fontSize: 11 }}>
              {realStoreIap ? "☑ " : "☐ "}
              {t("iap.realStoreToggle")}
            </Text>
          </Pressable>
        )}

        {/* Look preview + reroll (moved from the menu sheet's Shop view):
            the actual sprites, generated at runtime. */}
        <View
          style={{ ...styles.flexCenteredRow, gap: 8, alignItems: "center" }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Image
              source={{ uri: playerUri }}
              style={{ width: 32, height: 32 }}
              accessibilityRole="image"
            />
            <Image
              source={{ uri: playerPickaxeUri }}
              style={{ width: 24, height: 24, marginLeft: 4, marginBottom: -2 }}
            />
          </View>
          <Button title={t("cosmetics.reroll")} onPress={onReroll} />
        </View>

        {GROUP_ORDER.map((line) => (
          <View key={line} style={{ gap: 4 }}>
            <Text style={{ ...styles.text, opacity: 0.7, fontSize: 12 }}>
              {line === "pickaxe"
                ? t("iap.groupPickaxes")
                : line === "outfit"
                  ? t("iap.groupOutfits")
                  : line === "skin"
                    ? t("iap.groupSkin")
                    : themesLocked
                      ? t("cosmetics.themesLocked")
                      : t("iap.groupThemes")}
            </Text>
            {line === "caveTheme" && themesLocked && (
              <Text style={{ ...styles.text, fontSize: 11, color: "#999" }}>
                {t("cosmetics.themesUnlockedAt")}
              </Text>
            )}
            {line === "skin" && (
              // The feature-tier line: the player's own pixels replace
              // the outfit miner's body (docs/todo.md custom-skinning).
              <Text style={{ ...styles.text, fontSize: 11, color: "#999" }}>
                {t("iap.groupSkinDetail")}
              </Text>
            )}
            {line === "outfit" && (
              <>
                {/* Per-crew customization (todo: "allow visual customization
                    (iap cosmetic) of hired miners individually"): the wearer
                    selector. Outfits are free to move around once owned; the
                    crew slots offered are exactly the hires the column
                    renders (ROSTER_ASSIGNABLE_SLOTS), so every assignment
                    is visible in the shaft. */}
                <Text style={{ ...styles.text, fontSize: 11, color: "#999" }}>
                  {t("iap.outfitsDetail")}
                </Text>
                <View style={{ gap: 4 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 4,
                    }}
                  >
                    <WearerChip
                      label={t("iap.wearerYou")}
                      active={wearer === -1}
                      onPress={() => setWearer(-1)}
                    />
                    {Array.from({ length: hiredSlots }, (_, k) => (
                      <WearerChip
                        key={k}
                        label={t("iap.wearerMiner", { n: k + 1 })}
                        active={wearer === k}
                        onPress={() => setWearer(k)}
                      />
                    ))}
                  </View>
                </View>
              </>
            )}
            {line === "skin" ? (
              IAP_PRODUCT_LIST.filter((p) => p.line === line).map(
                renderSkinRow,
              )
            ) : (
              // Grid of cards (todo: "implement cosmetic shop with grid
              // view cards and larger previews") — previews at card size,
              // wrap 3 across on phone-to-tablet widths.
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {IAP_PRODUCT_LIST.filter((p) => p.line === line).map(
                  renderCard,
                )}
              </View>
            )}
          </View>
        ))}

        {/* Store purchases sync automatically on launch (the useIap
            launch-reconcile): no manual restore button — the store's
            record re-derives every completed purchase on this device. */}
      </View>
    </BottomModal>
  );
}

export default memo(IapPanel);