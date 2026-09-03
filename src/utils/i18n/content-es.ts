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
 * English item has one) replaces its blurb/unlock line; `body` (same rule)
 * carries the long legal-doc section texts. English itself has no table —
 * the data modules ARE the English source of truth.
 */
import type { ContentTable } from "./content";
import { LEGAL_CONTACT_EMAIL } from "src/mines_of_doom/legal";

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
  "outfit:marmot": {
    title: "Marmota de la madriguera",
    detail: "un roedor de bolsillo con una pico más grande que él",
  },
  "outfit:fox": {
    title: "Zorro de la veta",
    detail: "todo fuego y sin humo — el jugador habitual del equipo",
  },
  "outfit:otter": {
    title: "Nutria del río",
    detail: "la mejor del río — acumula tesoros brillantes en un nido de piedras",
  },
  "outfit:damsel": {
    title: "Dama de las profundidades",
    detail: "cabello largo, ropas más suaves, el mismo temple inquebrantable",
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
  // One pack per paid cosmetic (PACK_SPECS in iaps.ts) — titles reuse the
  // Spanish cosmetic names above (pickaxe/outfit/caveTheme namespaces).
  "iap:packGold": {
    title: "Pico de Oro",
    detail:
      "Compra única. Desbloquea el pico de Oro — con su propio sonido de " +
      "balanceo y su propio golpeo. Puramente cosmético.",
  },
  "iap:packFrost": {
    title: "Pico de Cristal",
    detail:
      "Compra única. Desbloquea el pico de Cristal — con su propio sonido " +
      "de balanceo y su propio golpeo. Puramente cosmético.",
  },
  "iap:packShadow": {
    title: "Pico de Sombra",
    detail:
      "Compra única. Desbloquea el pico de Sombra — con su propio sonido " +
      "de balanceo y el golpeo más pesado y deliberado. " +
      "Puramente cosmético.",
  },
  "iap:packNight": {
    title: "Traje de turno nocturno",
    detail:
      "Compra única. Desbloquea el traje de turno nocturno. " +
      "Puramente cosmético.",
  },
  "iap:packGoldrush": {
    title: "Traje de fiebre del oro",
    detail:
      "Compra única. Desbloquea el traje de fiebre del oro. " +
      "Puramente cosmético.",
  },
  "iap:packCrystal": {
    title: "Traje de minero de cristal",
    detail:
      "Compra única. Desbloquea el traje de minero de cristal. " +
      "Puramente cosmético.",
  },
  "iap:packMagma": {
    title: "Traje de operario de lava",
    detail:
      "Compra única. Desbloquea el traje de operario de lava. " +
      "Puramente cosmético.",
  },
  "iap:packBlocky": {
    title: "Traje de aventurero de bloques",
    detail:
      "Compra única. Desbloquea el traje de aventurero de bloques (un " +
      "homenaje al sándex voxel). Puramente cosmético.",
  },
  "iap:packSurface": {
    title: "Traje de explorador fronterizo",
    detail:
      "Compra única. Desbloquea el traje de explorador fronterizo (un " +
      "homenaje al sándex de superficie a subsuelo). Puramente cosmético.",
  },
  "iap:packKnight": {
    title: "Traje de caballero ceniciento",
    detail:
      "Compra única. Desbloquea el traje de caballero ceniciento (un " +
      "homenaje al soulslike dark fantasy). Puramente cosmético.",
  },
  "iap:packHunter": {
    title: "Traje de cazador errante",
    detail:
      "Compra única. Desbloquea el traje de cazador errante (un homenaje " +
      "a la cacería gótica). Puramente cosmético.",
  },
  "iap:packOni": {
    title: "Traje de oni carmesí",
    detail:
      "Compra única. Desbloquea el traje de oni carmesí (un homenaje a la " +
      "venganza de la era samurái). Puramente cosmético.",
  },
  "iap:packMarmot": {
    title: "Traje de marmota de la madriguera",
    detail:
      "Compra única. Desbloquea el traje de marmota de la madriguera (un " +
      "roedor de bolsillo con una pico más grande que él). " +
      "Puramente cosmético.",
  },
  "iap:packFox": {
    title: "Traje de zorro de la veta",
    detail:
      "Compra única. Desbloquea el traje de zorro de la veta (todo fuego " +
      "y sin humo — el jugador habitual del equipo). Puramente cosmético.",
  },
  "iap:packOtter": {
    title: "Traje de nutria del río",
    detail:
      "Compra única. Desbloquea el traje de nutria del río (la mejor del " +
      "río — acumula tesoros brillantes en un nido de piedras). " +
      "Puramente cosmético.",
  },
  "iap:packDamsel": {
    title: "Traje de dama de las profundidades",
    detail:
      "Compra única. Desbloquea el traje de dama de las profundidades " +
      "(cabello largo, ropas más suaves, el mismo temple inquebrantable). " +
      "Puramente cosmético.",
  },
  "iap:packAmethyst": {
    title: "Tema Cueva de amatista",
    detail:
      "Compra única. Desbloquea el tema de cueva Cueva de amatista. " +
      "Puramente cosmético.",
  },
  "iap:packVerdant": {
    title: "Tema Hoyo verdante",
    detail:
      "Compra única. Desbloquea el tema de cueva Hoyo verdante. " +
      "Puramente cosmético.",
  },
  "iap:packSolar": {
    title: "Tema Veta solar",
    detail:
      "Compra única. Desbloquea el tema de cueva Veta solar. " +
      "Puramente cosmético.",
  },
  "iap:packVoid": {
    title: "Tema Profundidades del vacío",
    detail:
      "Compra única. Desbloquea el tema de cueva Profundidades del vacío. " +
      "Puramente cosmético.",
  },
  "iap:packVoxel": {
    title: "Tema Minas de Blockfall",
    detail:
      "Compra única. Desbloquea el tema de cueva Minas de Blockfall " +
      "(tierra, hierba y mena brillante — un homenaje voxel). " +
      "Puramente cosmético.",
  },
  "iap:packWilds": {
    title: "Tema Selva de abajo",
    detail:
      "Compra única. Desbloquea el tema de cueva Selva de abajo (de la " +
      "superficie herbosa a la hellstone — un homenaje sándex). " +
      "Puramente cosmético.",
  },
  "iap:packAshen": {
    title: "Tema Profundidades cenicientas",
    detail:
      "Compra única. Desbloquea el tema de cueva Profundidades " +
      "cenicientas (niebla, piedra gris y una chispa — un homenaje dark " +
      "fantasy). Puramente cosmético.",
  },
  "iap:packGothic": {
    title: "Tema Niebla y farol",
    detail:
      "Compra única. Desbloquea el tema de cueva Niebla y farol (niebla " +
      "bajo la luna, resplandor del farol y una gota de sangre — un " +
      "homenaje a la cacería gótica). Puramente cosmético.",
  },
  "iap:packCherry": {
    title: "Tema Cerezo e índigo",
    detail:
      "Compra única. Desbloquea el tema de cueva Cerezo e índigo (flores " +
      "sobre la noche índigo, oro en el fondo — un homenaje de la era " +
      "samurái). Puramente cosmético.",
  },

  // --- Legal docs (LEGAL_DOCS in legal.ts) -------------------------------
  // Titles, section headings AND bodies are localized here.
  "legalDoc:privacy": { title: "Política de privacidad" },
  "legalDoc:terms": { title: "Términos de uso y descargo" },

  "legalSection:privacy:Short version": {
    title: "Versión corta",
    body:
      "Mines of Doom no recopila información personal. Tus datos de juego se guardan solo en tu dispositivo, nada se envía por la red y no existe ningún sistema de cuentas. Esta política lo detalla y cubre los pocos casos límite (las compras en la aplicación y los anuncios con recompensa, si llegaran a estar disponibles en tu plataforma).",
  },
  "legalSection:privacy:What we store, and where": {
    title: "Qué guardamos, y dónde",
    body:
      "Todo lo que el juego guarda vive en el almacenamiento privado de tu dispositivo (Android/iOS: el almacenamiento privado de la app vía AsyncStorage; web: el almacenamiento local de tu navegador para este sitio). Incluye:\n\n• Tus datos de juego (minerales, mejoras, cosméticos, metas, logros, ajustes).\n• Un pequeño registro de estadísticas locales (cuándo abriste la app por primera vez, días de uso, primer visionado de anuncio, número de compras, número de prestigios). Se usa solo para nuestras propias decisiones de desarrollo, se puede leer en el dispositivo en Ajustes → «Estadísticas locales (depuración)» y se puede borrar allí en cualquier momento.\n• Un breve registro de errores (solo mensajes de error recientes, nunca tus datos de juego ni nada personal), visible y borrable en Ajustes → «Errores recientes (depuración)».\n• Marcas de tiempo para el bono diario y los límites de recompensa de anuncios.\n\nNinguno de estos datos sale nunca de tu dispositivo. Además, puedes borrarlo todo de una vez con Ajustes → Restablecer.",
  },
  "legalSection:privacy:What we do NOT collect": {
    title: "Qué NO recopilamos",
    body:
      "Ni nombre, ni dirección de correo electrónico, ni ninguna otra información personal. Sin identificadores de dispositivo. Sin SDK de análisis de terceros. Sin transmisión por red de ningún tipo. No hay cuentas, ni inicio de sesión, ni ninguna forma de que identifiquemos a una persona o vinculemos los datos de juego con ella.\n\nLa función «Código de guardado» (Ajustes → Código de guardado) genera un código que contiene tus datos de juego. Compartir ese código es compartir tu progreso: no lo compartas con personas de quien no te fíes. Nunca te lo pediremos.",
  },
  "legalSection:privacy:In-app purchases": {
    title: "Compras en la aplicación",
    body:
      "Las compras en la aplicación opcionales (packs cosméticos y «Eliminar anuncios») las procesa la tienda de apps desde la que instalaste el juego (Google Play o la App Store de Apple). Los datos de pago los gestiona la tienda, no nosotros: solo sabemos que una compra tuvo éxito, para que el juego pueda entregar el artículo. La versión web del juego es 100 % gratuita y no ofrece ninguna compra.",
  },
  "legalSection:privacy:Advertising": {
    title: "Publicidad",
    body:
      "La versión web del juego no contiene publicidad de ningún tipo.\n\nLas versiones para móvil pueden ofrecer anuncios de vídeo con recompensa, estrictamente opcionales y iniciados por el jugador (tú mismo pulsas «ver», y solo recibes la recompensa dentro del juego si terminas el vídeo; no hay ningún otro formato de anuncio). Si un proveedor de anuncios con recompensa está activo en tu plataforma, puede procesar los datos que su propia política de privacidad describe con el fin de servir esos vídeos; no le transmitimos ninguna información personal sobre ti, y ningún anuncio afecta jamás al juego fuera de la recompensa que pediste explícitamente. Los ajustes de anuncio y el opt-out se gestionan a través de los controles de anuncios de la tienda/plataforma. Somos un desarrollador independiente y no tenemos afiliación con Google, Apple ni ninguna red de publicidad.",
  },
  "legalSection:privacy:Children": {
    title: "Menores",
    body:
      "El juego está pensado para todas las edades y no contiene chat, ni enlaces externos, ni contenido generado por usuarios. En consecuencia, la publicidad (donde exista) se configura para el tratamiento de contenido dirigido a menores y las recompensas son siempre artículos dentro del juego: nunca bienes del mundo real.",
  },
  "legalSection:privacy:Changes to this policy": {
    title: "Cambios de esta política",
    body: "Los cambios importantes se indicarán aquí con una nueva versión y fecha.",
  },
  "legalSection:privacy:Contact": {
    title: "Contacto",
    body: `Las preguntas, o las peticiones de borrado de tus datos (más allá de los controles Limpiar/Restablecer de la app), pueden enviarse a ${LEGAL_CONTACT_EMAIL}.`,
  },

  "legalSection:terms:The game": {
    title: "El juego",
    body:
      "Mines of Doom («el juego») es un juego idle de minería gratuito. «Gratis» significa que puedes llegar al juego completo y a todo su contenido de final sin gastar dinero; algunos artículos cosméticos también se pueden comprar con dinero real, y todo lo comprable también se puede obtener jugando.",
  },
  "legalSection:terms:Virtual goods": {
    title: "Bienes virtuales",
    body:
      "Los minerales, las gemas y todos los demás artículos del juego son solo virtuales. No tienen valor en el mundo real, no pueden canjearse por dinero o bienes y no pueden transferirse entre jugadores excepto mediante la función de código de guardado, que usas bajo tu propia responsabilidad (importar un código reemplaza tu guardado actual).",
  },
  "legalSection:terms:In-app purchases": {
    title: "Compras en la aplicación",
    body:
      "Las compras se cargan en tu cuenta de la tienda de apps y están sujetas a los propios términos y la política de devoluciones de la tienda. Los artículos comprados se entregan a la cuenta del dispositivo en el que los compraste y una compra de «Eliminar anuncios» o de un pack cosmético es definitiva una vez que el artículo se ha entregado o usado. Al comprar confirmas que aceptas los términos de servicio de la tienda de apps.",
  },
  "legalSection:terms:Your save data": {
    title: "Tus datos de guardado",
    body:
      "Tu progreso se guarda en tu dispositivo (ver la Política de privacidad). Borrar los datos locales de la app, reinstalarla o usar Ajustes → Restablecer borrará tu progreso de forma permanente. La función de código de guardado se ofrece como copia de seguridad/medio de intercambio; no guardamos copia de tu guardado y no podemos restaurarlo si se pierde.",
  },
  "legalSection:terms:No affiliation": {
    title: "Sin afiliación",
    body:
      "El juego es un producto independiente. No está afiliado, respaldado ni patrocinado por Apple Inc., Google LLC ni ninguna red de publicidad. «Apple», el logotipo de Apple, «iPhone», «iOS» y «App Store» son marcas registradas de Apple Inc.; «Google Play» y «Android» son marcas registradas de Google LLC. Todas las marcas son propiedad de sus respectivos titulares.",
  },
  "legalSection:terms:Disclaimer": {
    title: "Descargo de responsabilidad",
    body:
      "El juego se proporciona «tal cual», sin garantía de ningún tipo, expresa o implícita, incluyendo, sin limitación, la aptitud para un propósito concreto, la comerciabilidad y la no infracción. No garantizamos que el juego sea ininterrumpido, libre de errores o disponible en un momento concreto. En la máxima medida permitida por la ley, no nos hacemos responsables de ninguna pérdida de progreso, de artículos virtuales ni de otros daños derivados del uso del juego.",
  },
  "legalSection:terms:Changes": {
    title: "Cambios",
    body: "Podemos actualizar el juego y estos términos con el tiempo; los cambios importantes se indicarán con una nueva versión y fecha.",
  },
  "legalSection:terms:Contact": {
    title: "Contacto",
    body: `Las preguntas sobre estos términos pueden enviarse a ${LEGAL_CONTACT_EMAIL}.`,
  },
};
