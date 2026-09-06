/**
 * Minimal typing for react-native-web — the package ships no type
 * declarations, so the one escape-hatch function we use is declared here:
 * `unstable_createElement`, the supported way to render an arbitrary raw
 * DOM element from React Native on web (used by
 * src/mines_of_doom/components/AdSenseBanner.web.tsx for the AdSense
 * `<ins class="adsbygoogle">` unit).
 */
declare module "react-native-web" {
  import type * as React from "react";
  /**
   * Renders an arbitrary host (DOM) element in the web renderer.
   * `component` is the lowercase tag name; props pass through to the DOM
   * (className, style, data-* attributes, etc.).
   */
  export function unstable_createElement(
    component: string,
    props?: Record<string, unknown>,
  ): React.ReactElement;
}
