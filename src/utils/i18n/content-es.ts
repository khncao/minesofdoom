/**
 * Spanish CONTENT-NAMES table (the data-driven follow-up to en.ts/es.ts).
 *
 * Keys are `ns:id` (see ContentNamespace in content.ts). Every key must
 * exist exactly once — content.test.ts walks the actual data modules
 * (game.ts, goals.ts, cosmetics.ts, achievements.ts, records.ts, iaps.ts,
 * legal.ts) and pins this table against their key set: a missing key
 * degrades to English at render time (translateContent), and an extra key
 * is a test failure, so this file can't silently drift from the data.
 *
 * `title` replaces the data item's name/label; `detail` (only where the
 * English item has one) replaces its blurb/unlock line. English itself has
 * no table — the data modules ARE the English source of truth.
 */
import type { ContentTable } from "./content";

export const contentEs: ContentTable = {
  // --- Depth tiers / biomes (DEPTH_TIERS in game.ts) -------------------
  "depthTier:0": { title: "Cavernas de superficie" },
  "depthTier:1": { title: "Gruta profunda" },
  "depthTier:2": { title: "Profundidades cristalinas" },
  "depthTier:3": { title: "Frontera de magma" },
  "depthTier:4": { title: "Reino de cristal" },

  // --- Goal tiers (GOAL_TIERS in goals.ts) ------------------------------
  "goalTier:t1": {
    title: "Licencia de prospector",
    detail: "Mejoras de poder de minero",
  },
  "goalTier:t2": {
    title: "Pozo profundo",
    detail: "Mineros rápidos + mejora de probabilidad de gemas",
  },
  "goalTier:t3": {
    title: "Frontera de magma",
    detail:
      "Prestigio / nuevo pozo + mejoras de gemas (clic ×2, resistencia de combo)",
  },
  "goalTier:t4": {
    title: "Reino de cristal",
    detail: "Temas de cueva",
  },
  "goalTier:t5": {
    title: "Veta madre",
    detail: "Mineros legendarios + ecuaciones de modo difícil",
  },

  // --- Individual goal labels -------------------------------------------
  "goal:t1-depth": { title: "Alcanza 10 m de profundidad" },
  "goal:t1-answers": { title: "Resuelve 50 ecuaciones correctamente" },
  "goal:t1-miner": { title: "Consigue tu primer minero" },
  "goal:t2-depth": { title: "Alcanza 50 m de profundidad" },
  "goal:t2-miners": { title: "Consigue 10 mineros" },
  "goal:t2-combo": { title: "Consigue un combo de 50" },
  "goal:t2-gems": { title: "Gasta 10 gemas" },
  "goal:t3-depth": { title: "Alcanza 150 m de profundidad" },
  "goal:t3-power": { title: "Mejora el poder de minero 10 veces" },
  "goal:t3-gems": { title: "Obtén 100 gemas" },
  "goal:t3-combo": { title: "Consigue un combo de 100" },
  "goal:t4-prestige": { title: "Prestigia una vez" },
  "goal:t4-depth": { title: "Alcanza 500 m de profundidad" },
  "goal:t4-answers": { title: "Resuelve 1.000 ecuaciones correctamente" },
  "goal:t5-prestige": { title: "Prestigia 3 veces" },
  "goal:t5-depth": { title: "Alcanza 1500 m de profundidad" },
  "goal:t5-combo": { title: "Consigue un combo de 500" },
  "goal:t5-lifetime": {
    title: "Extrae 1.000 millones de minerales en total",
  },

  // --- Achievements (ACHIEVEMENTS in achievements.ts) --------------------
  "achievement:miner-1": { title: "Primer contrato" },
  "achievement:miner-5": { title: "Equipo de cinco" },
  "achievement:miner-10": { title: "Capataz" },
  "achievement:miner-25": { title: "Jefe de obra" },
  "achievement:gem-1": { title: "Veta descubierta" },
  "achievement:gem-10": { title: "Acumulador de gemas" },
  "achievement:gem-50": { title: "Manos de diamante" },
  "achievement:gem-100": { title: "Guardián del cofre" },
  "achievement:combo-25": { title: "En racha" },
  "achievement:combo-100": { title: "Racha centenaria" },
  "achievement:combo-250": { title: "Imparable" },
  "achievement:depth-10": { title: "Excavador de tierra" },
  "achievement:depth-50": { title: "Buzo del pozo" },
  "achievement:depth-150": { title: "Buzo de magma" },
  "achievement:depth-500": { title: "Buzo de cristal" },
  "achievement:answers-100": { title: "Aprendiz de matemáticas" },
  "achievement:answers-1000": { title: "Maestro de las matemáticas" },
  "achievement:mine-1m": { title: "Millonario" },
  "achievement:mine-1b": { title: "Club de los mil millones" },

  // --- Records (getRecords in records.ts) --------------------------------
  "record:depth": { title: "Profundidad máxima" },
  "record:combo": { title: "Combo más largo" },
  "record:minerals": { title: "Minerales extraídos (total)" },
  "record:answers": { title: "Ecuaciones resueltas" },
  "record:miners": { title: "Más mineros a la vez" },
  "record:gems-minted": { title: "Gemas obtenidas" },
  "record:gems-spent": { title: "Gemas gastadas" },
  "record:prestige": { title: "Pozos excavados (prestigios)" },
  "record:tiers": { title: "Niveles de metas completados" },
  "record:achievements": { title: "Logros conseguidos" },

  // --- Cosmetics (cosmetics.ts) ------------------------------------------
  "outfit:classic": { title: "Equipo clásico" },
  "outfit:night": { title: "Turno nocturno" },
  "outfit:goldrush": { title: "Fiebre del oro" },
  "outfit:crystal": { title: "Minero de cristal" },
  "outfit:magma": { title: "Operario de lava" },
  "outfit:blocky": {
    title: "Aventurero de bloques",
    detail: "un homenaje al sándex voxel",
  },
  "outfit:surface": {
    title: "Explorador fronterizo",
    detail: "un homenaje al sándex de superficie a subsuelo",
  },
  "outfit:knight": {
    title: "Caballero ceniciento",
    detail: "un homenaje al soulslike dark fantasy",
  },
  "outfit:hunter": {
    title: "Cazador errante",
    detail: "un homenaje a la cacería gótica",
  },
  "outfit:oni": {
    title: "Oni carmesí",
    detail: "un homenaje a la venganza de la era samurái",
  },

  "pickaxe:steel": { title: "Acero" },
  "pickaxe:gold": { title: "Oro" },
  "pickaxe:frost": { title: "Cristal" },
  "pickaxe:shadow": { title: "Sombra" },

  "caveTheme:natural": { title: "Natural" },
  "caveTheme:amethyst": { title: "Cueva de amatista" },
  "caveTheme:verdant": { title: "Hoyo verdante" },
  "caveTheme:solar": { title: "Veta solar" },
  "caveTheme:void": { title: "Profundidades del vacío" },
  "caveTheme:voxel": {
    title: "Minas de Blockfall",
    detail: "tierra, hierba y mena brillante — un homenaje voxel",
  },
  "caveTheme:wilds": {
    title: "Selva de abajo",
    detail: "de la superficie herbosa a la hellstone — un homenaje sándex",
  },
  "caveTheme:ashen": {
    title: "Profundidades cenicientas",
    detail: "niebla, piedra gris y una chispa — un homenaje dark fantasy",
  },
  "caveTheme:gothic": {
    title: "Niebla y farol",
    detail:
      "niebla bajo la luna, resplandor del farol y una gota de sangre — un homenaje a la cacería gótica",
  },
  "caveTheme:cherry": {
    title: "Cerezo e índigo",
    detail:
      "flores sobre la noche índigo, oro en el fondo — un homenaje de la era samurái",
  },

  // --- IAP products (IAP_PRODUCTS in iaps.ts) ----------------------------
  "iap:removeAds": {
    title: "Eliminar anuncios",
    detail:
      "Compra única. Oculta permanentemente el panel de anuncios con " +
      "recompensa — nada más cambia, y el juego sigue siendo completamente " +
      "gratuito y jugable hasta el final sin ella.",
  },
  "iap:packShadowPick": {
    title: "Pico de sombra",
    detail:
      "Compra única. Desbloquea el pico Sombra — con su propio sonido de " +
      "balanceo y el golpeo más pesado y deliberado. Puramente cosmético.",
  },
  "iap:packOniOutfit": {
    title: "Traje de Oni carmesí",
    detail:
      "Compra única. Desbloquea el traje Oni carmesí (un homenaje a la " +
      "venganza de la era samurái). Puramente cosmético.",
  },
  "iap:packCherryTheme": {
    title: "Tema Cerezo e índigo",
    detail:
      "Compra única. Desbloquea el tema de cueva Cerezo e índigo. " +
      "Puramente cosmético.",
  },

  // --- Legal docs (LEGAL_DOCS in legal.ts) -------------------------------
  // Titles + section headings are localized; the section BODIES stay
  // English for now (see docs/todo.md).
  "legalDoc:privacy": { title: "Política de privacidad" },
  "legalDoc:terms": { title: "Términos de uso y descargo" },

  "legalSection:privacy:Short version": { title: "Versión corta" },
  "legalSection:privacy:What we store, and where": {
    title: "Qué guardamos, y dónde",
  },
  "legalSection:privacy:What we do NOT collect": {
    title: "Qué NO recopilamos",
  },
  "legalSection:privacy:In-app purchases": {
    title: "Compras en la aplicación",
  },
  "legalSection:privacy:Advertising": { title: "Publicidad" },
  "legalSection:privacy:Children": { title: "Menores" },
  "legalSection:privacy:Changes to this policy": {
    title: "Cambios de esta política",
  },
  "legalSection:privacy:Contact": { title: "Contacto" },

  "legalSection:terms:The game": { title: "El juego" },
  "legalSection:terms:Virtual goods": { title: "Bienes virtuales" },
  "legalSection:terms:In-app purchases": {
    title: "Compras en la aplicación",
  },
  "legalSection:terms:Your save data": { title: "Tus datos de guardado" },
  "legalSection:terms:No affiliation": { title: "Sin afiliación" },
  "legalSection:terms:Disclaimer": {
    title: "Descargo de responsabilidad",
  },
  "legalSection:terms:Changes": { title: "Cambios" },
  "legalSection:terms:Contact": { title: "Contacto" },
};
