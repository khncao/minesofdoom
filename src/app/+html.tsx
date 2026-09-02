import React from "react";
import { ScrollViewStyleReset } from "expo-router/html";

/**
 * Custom document template for the web export.
 *
 * expo-router's default template (`expo-router/html`) has NO <title> tag, so
 * the deployed index.html shipped with an empty tab title — and no meta
 * description or theme-color. `+html` files are the standard escape hatch:
 * they are filtered out of the route table (like `+api`), so this adds no
 * HTML routes to the static export.
 *
 * Keep this in sync with app.config.ts (the favicon comes from there).
 */
export default function Html({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <title>Mines of Doom</title>
        <meta
          name="description"
          content="Mines of Doom — an idle math-mining game. Solve equations, earn minerals, buy miners, sink new shafts."
        />
        <meta name="theme-color" content="#2f2f2f" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
