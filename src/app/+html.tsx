import React from "react";
import { ScrollViewStyleReset } from "expo-router/html";
import {
    storeConfig,
    isAdSenseConfigured,
} from "src/mines_of_doom/storeConfig";
import {
    SITE_CONTACT_EMAIL,
    SITE_NAV_LINKS,
    SITE_PUBLISHER,
    WEB_CONTENT_SECTIONS,
    WEB_FAQ,
    WEB_LANDING_HEADING,
    WEB_LANDING_INTRO,
} from "src/mines_of_doom/siteContent";

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
                {/* SEO / social (docs/todo.md: improve seo): canonical + Open Graph +
                    Twitter card so the game renders with a title, description and
                    image when shared. og-image.png is copied from public/ into the
                    static export root (app-icons/icon.png — kept out of public/ for
                    the build, like the favicon source). Single-route static app, so
                    the head is shared by every exported page. */}
                <link rel="canonical" href="https://minesofdoom.minus4kelvin.com/" />
                <meta property="og:type" content="website" />
                <meta property="og:site_name" content="Mines of Idle Doomath" />
                <meta property="og:title" content="Mines of Idle Doomath" />
                <meta
                    property="og:description"
                    content="An idle math-mining game. Solve equations, earn minerals, buy miners, sink new shafts."
                />
                <meta
                    property="og:url"
                    content="https://minesofdoom.minus4kelvin.com/"
                />
                <meta
                    property="og:image"
                    content="https://minesofdoom.minus4kelvin.com/og-image.png"
                />
                <meta name="twitter:card" content="summary" />
                <meta name="twitter:title" content="Mines of Idle Doomath" />
                <meta
                    name="twitter:description"
                    content="An idle math-mining game. Solve equations, earn minerals, buy miners, sink new shafts."
                />
                <meta
                    name="twitter:image"
                    content="https://minesofdoom.minus4kelvin.com/og-image.png"
                />
                {/* Minimal JSON-LD so search engines know what the site is (free
                    web game) — no og-image dependency, one small block. */}
                <script type="application/ld+json">
                    {`
                        {
                            "@context": "https://schema.org",
                            "@type": "WebApplication",
                            "name": "Mines of Idle Doomath",
                            "url": "https://minesofdoom.minus4kelvin.com/",
                            "description": "An idle math-mining game. Solve equations, earn minerals, buy miners, sink new shafts.",
                            "applicationCategory": "GameApplication",
                            "operatingSystem": "Web, Android, iOS",
                            "offers": {
                                "@type": "Offer",
                                "price": "0",
                                "priceCurrency": "USD"
                            }
                        }`}
                </script>
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
                {/* Landing/content layer (see src/mines_of_doom/siteContent.ts).
                    The game is client-rendered, so the exported HTML used to
                    contain no readable text — which is exactly the AdSense
                    "insufficient content" rejection. The rules below let the
                    document scroll to the server-rendered copy that
                    <SiteInfo/> appends after the game: #root keeps owning
                    exactly one viewport (100dvh) so play is unchanged, and the
                    page below it is ordinary scrollable content. */}
                <style>{`
                    html { height: auto; }
                    body {
                        height: auto;
                        min-height: 100vh;
                        min-height: 100dvh;
                        overflow-x: hidden;
                        overflow-y: auto;
                    }
                    #root {
                        height: 100vh;
                        height: 100dvh;
                        flex: none;
                        /* The game is a fixed screen: clip it to its one
                           viewport exactly as the old body{overflow:hidden}
                           reset did, so it can never bleed into the copy. */
                        overflow: hidden;
                    }
                    #site-info {
                        background: #1c1c1c;
                        color: #e8e8e8;
                        padding: 2.5rem 1.25rem 3rem;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        font-size: 16px;
                        line-height: 1.6;
                        border-top: 1px solid #444;
                    }
                    #site-info main,
                    #site-info footer { max-width: 760px; margin: 0 auto; }
                    #site-info h1 { font-size: 1.7rem; line-height: 1.25; margin: 0 0 1rem; }
                    #site-info h2 { font-size: 1.25rem; margin: 2rem 0 0.5rem; }
                    #site-info h3 { font-size: 1.05rem; margin: 1.35rem 0 0.25rem; }
                    #site-info p { margin: 0.55rem 0; }
                    #site-info ul,
                    #site-info ol { margin: 0.55rem 0; padding-left: 1.4rem; }
                    #site-info li { margin: 0.3rem 0; }
                    #site-info a { color: #8fc7ff; }
                    #site-info footer {
                        margin-top: 2.5rem;
                        padding-top: 1.25rem;
                        border-top: 1px solid #3a3a3a;
                        font-size: 0.95rem;
                        color: #b5b5b5;
                    }
                    #site-info nav {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.5rem 1.1rem;
                        margin-bottom: 0.6rem;
                    }
                `}</style>
            </head>
            <body>
                {children}
                <SiteInfo />
            </body>
        </html>
    );
}

/**
 * Server-rendered site content: the game page's readable copy and the site
 * navigation, in the HTML source (not painted by JS), so crawlers and
 * reviewers see a real page. Content lives in
 * `src/mines_of_doom/siteContent.ts`; the nav links are pinned to the files
 * that ship in `public/` by `__test__/siteContent.test.ts`.
 *
 * Plain DOM elements on purpose (this file is the document template, not a
 * React Native screen), and local per-section keys are fine because nothing
 * here re-renders.
 */
function SiteInfo() {
    return (
        <div id="site-info">
            <main>
                <h1>{WEB_LANDING_HEADING}</h1>
                {WEB_LANDING_INTRO.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                ))}
                {WEB_CONTENT_SECTIONS.map((section) => (
                    <section key={section.heading}>
                        <h2>{section.heading}</h2>
                        {section.paragraphs?.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                        ))}
                        {section.numbered && (
                            <ol>
                                {section.numbered.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ol>
                        )}
                        {section.bullets && (
                            <ul>
                                {section.bullets.map((item) => (
                                    <li key={item}>{item}</li>
                                ))}
                            </ul>
                        )}
                    </section>
                ))}
                <section>
                    <h2>Frequently asked questions</h2>
                    {WEB_FAQ.map((entry) => (
                        <div key={entry.question}>
                            <h3>{entry.question}</h3>
                            <p>{entry.answer}</p>
                        </div>
                    ))}
                </section>
            </main>
            <footer>
                <nav aria-label="Site">
                    {SITE_NAV_LINKS.map((link) => (
                        <a key={link.href} href={link.href}>
                            {link.label}
                        </a>
                    ))}
                </nav>
                <p>
                    Mines of Idle Doomath ·{" "}
                    <a href={`mailto:${SITE_CONTACT_EMAIL}`}>
                        {SITE_CONTACT_EMAIL}
                    </a>
                </p>
                <p>
                    <a href={SITE_PUBLISHER.url} rel="noopener">
                        {SITE_PUBLISHER.label}
                    </a>
                </p>
            </footer>
        </div>
    );
}
