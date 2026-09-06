/**
 * AdSense display banner (docs/todo.md #2) — NON-WEB variant: no-op.
 *
 * Web resolves `./AdSenseBanner.web.tsx` (the real banner) via Metro's
 * `.web` swap, so this file — and the react-native-web import — never
 * enter a native bundle. Web placement rules and gating live in the
 * `.web` file: shop sheet only (never over the canvas), labeled, and
 * hidden while storeConfig.adsense is empty.
 */
export default function AdSenseBanner(): null {
  return null;
}
