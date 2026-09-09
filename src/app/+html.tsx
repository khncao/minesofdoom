import React from "react";
import { ScrollViewStyleReset } from "expo-router/html";
import {
    storeConfig,
    isAdSenseConfigured,
} from "src/mines_of_doom/storeConfig";

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
                <title>Mines of Idle Doomath</title>
                <meta
                    name="description"
                    content="Mines of Idle Doomath — an idle math-mining game. Solve equations, earn minerals, buy miners, sink new shafts."
                />
                <meta name="theme-color" content="#2f2f2f" />
                {/* AdSense loader (docs/todo.md #2): emitted ONLY when the
            publisher client is configured (empty config = hidden no-op —
            zero ad-network traffic until it lands). This single loader
            also powers the Ad Placement API (H5 Games Ads): the rewarded
            placements are pushed onto window.adsbygoogle at probe time
            from adSenseProvider.web.ts, never rendered as a DOM unit —
            rewarded full-screen ads only, player-tapped (guardrail 2).
            Exporting with EXPO_PUBLIC_ADSENSE_TEST=1 adds
            data-adbreak-test="on" — Google's documented test mode: mock
            ads, NO requests to Google's servers, cycling ad-loaded /
            ad-not-loaded. Use it to validate the pipeline on the deployed
            domain before the account is approved for H5 Games Ads; the
            export is flag-free by default and a test build must be
            re-deployed without the flag afterwards (docs/store-integration.md
            §1.1). */}
                {isAdSenseConfigured() && (
                    <script
                        async
                        {...(process.env.EXPO_PUBLIC_ADSENSE_TEST === "1"
                            ? { "data-adbreak-test": "on" }
                            : {})}
                        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${storeConfig.adsense.client}`}
                        crossOrigin="anonymous"
                    />
                )}
                <ScrollViewStyleReset />
            </head>
            <body>{children}</body>
        </html>
    );
}
