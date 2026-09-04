/**
 * Spanish (es) translation table. Typed as `Record<TranslationKey, string>`
 * against the English key set, so a missing or extra key is a compile
 * error; `{placeholder}` parity is additionally pinned in i18n.test.ts.
 * Same casing/emoji conventions as en.ts (ALL-CAPS button style).
 */
import type { TranslationKey } from "./en";

export const es: Record<TranslationKey, string> = {
  // --- Loading & errors -------------------------------------------------
  "loading.mine": "cargando la mina…",
  "error.title": "⛏️ Algo salió mal",
  "error.body":
    "El juego tuvo un error inesperado y dejó de mostrarse. Tu partida está " +
    "a salvo: se guarda automáticamente en el dispositivo y estará aquí " +
    "cuando el juego vuelva a abrir.",
  "error.contextHeading": "lo que estaba pasando:",
  "error.tryAgain": "Reintentar",
  "error.reloadPage": "Recargar página",
  "error.hint":
    "Mantén pulsado el texto del error para copiarlo. Los errores " +
    "recientes también quedan en menú → Ajustes → “Errores recientes (dep.)” " +
    "tras un reinicio.",

  // --- Main screen ------------------------------------------------------
  "main.upgrades": "MEJORAS",
  "main.a11yShowUpgrades": "Mostrar mejoras",
  "main.a11yHideUpgrades": "Ocultar mejoras",
  "main.keypad": "TECLADO",
  "main.a11yUpgradesTab": "Pestaña de mejoras",
  "main.a11yKeypadTab": "Pestaña de teclado",
  "main.a11yMenu": "Menú",
  "main.a11yLeaderboard": "Clasificación — los mejores mineros",

  // --- Toasts / messages --------------------------------------------------
  "toast.depth": "¡Profundidad {depth}m — cada vez más profundo en la cueva!",
  "toast.enteredTier": "¡Entraste en {tier}! Poder de clic ×{bonus}",
  "toast.tierComplete":
    "🏆 ¡{tier} completado! +{bonus} 🪨 — desbloquea: {unlock}",
  "toast.achievement": "🏅 {label}! +{bonus} 🪨",
  "toast.vein": "¡Encontraste una veta! +1 💎",
  "toast.comboUp": "¡Combo x{mult}!",
  "toast.streakIgnited": "🔥 ¡Racha encendida — ×2 por respuesta!",
  "toast.comboDropped": "¡El combo bajó a {combo}!",
  "toast.comboLost": "¡Combo perdido!",
  "toast.saved": "Partida guardada",
  "toast.settingsSaved": "Guardado",
  "toast.invalidSaveCode": "Código de guardado no válido.",
  "toast.saveImported": "¡Guardado importado!",
  "toast.cloudRestored": "Partida recuperada desde la copia en la nube",
  "toast.cloudNoBackup": "Todavía no hay copia en la nube",
  "toast.cloudRestoreFailed": "No se pudo leer la copia en la nube",
  "toast.dataDeleted": "Tus datos se han eliminado del servidor",
  "toast.dataDeleteFailed":
    "No se pudo contactar al servidor — no se eliminó nada",
  "toast.welcomeBack":
    "¡Bienvenido de nuevo! Tus mineros recogieron {count} 🪨 mientras no estabas.",
  "toast.saveFailed": "Aviso: no se pudo guardar tu partida.",
  "toast.dailyBonus": "Bonus diario: +{bonus} minerales",
  "toast.dailyBonusStreak":
    "Bonus diario: +{bonus} minerales (¡racha de {streak} días!)",
  "toast.iapRemoveAds": "¡Anuncios eliminados! Gracias por apoyar el juego.",
  "toast.iapPackUnlocked": "Desbloqueaste {name} — ¡búscalo en Cosméticos!",
  "toast.iapComplete": "¡Compra completada!",
  "toast.adFinishedGems": "Anuncio terminado: +{count} 💎",
  "toast.adFinishedDouble":
    "Anuncio terminado: botín offline doblado (+{count} 🪨)",
  "toast.adFinishedTopUp":
    "Anuncio terminado: recarga offline +2h (+{count} 🪨)",
  "toast.adFinishedCombo": "Anuncio terminado: combo restaurado a {combo}",
  "toast.adClosedEarly": "Anuncio cerrado antes de tiempo — sin recompensa.",

  // --- Combo indicator ----------------------------------------------------
  "combo.active": "🔥 combo de {combo}x",
  "combo.untilNext": "{count} más → ×{mult}",

  // --- Equation area ------------------------------------------------------
  "equation.pending": "correcto: +{gain} 🪨",
  "equation.detail": " (×{mult}{suffix})",
  "equation.tagHard": "difícil",
  "equation.tagTimed": "contrarreloj",
  "equation.tagStreak": "racha",
  "equation.streakProgress": "🔥 racha {n}/{threshold}",
  "equation.streakIgnited": "🔥 racha ×2",
  "equation.a11yTimed": "Modo contrarreloj: quedan {seconds} segundos",

  // --- Purchase buttons ---------------------------------------------------
  "purchase.groupMinerals": "GASTAR 🪨 MINERALES",
  "purchase.groupGems": "GASTAR 💎 GEMAS",
  "purchase.groupPrestige": "PRESTIGIO",
  "purchase.nextCost": ", siguiente {cost}",
  "purchase.upgradePower": "MEJORAR PODER (-{cost} 🪨) ({power})",
  "purchase.upgradeMiners": "MEJORAR MINEROS (-{cost} 🪨) ({power})",
  "purchase.upgradeMinersLocked":
    "🔒 MEJORAR MINEROS (Prospector's License)",
  "purchase.buyGem": "COMPRAR UNA GEMA (-{cost} 🪨)",
  "purchase.buyMiner":
    "COMPRAR UN MINERO (-{cost} 💎) ({count}{next})",
  "purchase.buyFastMiner":
    "COMPRAR UN MINERO RÁPIDO (-{cost} 💎) ({count}, {output}/s cada uno{next})",
  "purchase.buyFastMinerLocked": "🔒 COMPRAR MINERO RÁPIDO (Deep Shaft)",
  "purchase.buyLegendaryMiner":
    "COMPRAR UN MINERO LEGENDARIO (-{cost} 💎) ({count}, {output}/s cada uno{next})",
  "purchase.buyLegendaryMinerLocked":
    "🔒 COMPRAR MINERO LEGENDARIO (Motherlode)",
  "purchase.gemChanceLocked": "🔒 SUERTE DE GEMAS +1% (Deep Shaft)",
  "purchase.gemChanceMaxed": "SUERTE DE GEMAS {pct}% (MÁX)",
  "purchase.gemChance": "SUERTE DE GEMAS +1% (-{cost} 💎) (ahora {pct}%)",
  "purchase.clickBoostLocked": "🔒 CLIC ×2 (Magma Frontier)",
  "purchase.clickBoostMaxed": "PODER DE CLIC ×{mult} (MÁX)",
  "purchase.clickBoost": "CLIC ×2 (-{cost} 💎) (ahora ×{mult})",
  "purchase.comboResistLocked": "🔒 RESISTENCIA DE COMBO (Magma Frontier)",
  "purchase.comboResistMaxed": "RESISTENCIA DE COMBO (conserva {pct}%) (MÁX)",
  "purchase.comboResist":
    "RESISTENCIA DE COMBO (-{cost} 💎) (conserva {pct}%)",
  "purchase.sinkNewShaftLocked": "🔒 HUNDIR NUEVO POZÓ (Magma Frontier)",
  "purchase.sinkNewShaftCanBank":
    "⛏️ HUNDIR NUEVO POZÓ → ×{next} (ahora ×{banked})",
  "purchase.sinkNewShaftNeed":
    "⛏️ HUNDIR NUEVO POZÓ ×{banked} — hacen falta {at} 🪨 en total para ×{next}",
  "purchase.sinkNewShaftMax": "⛏️ HUNDIR NUEVO POZÓ ×{banked} (MÁX)",

  // --- Daily bonus --------------------------------------------------------
  "a11y.dailyClaimable": "Reclamar bonus diario: +{bonus} minerales",
  "a11y.dailyClaimableStreak":
    "Reclamar bonus diario: +{bonus} minerales, inicia la racha del día {day}",
  "a11y.dailyClaimed":
    "Bonus diario reclamado hoy. Vuelve mañana para el siguiente bonus.",

  // --- Save pill ----------------------------------------------------------
  "save.pill": "Guardar",
  "a11y.save": "Guardar partida",
  "a11y.saveDirty": "Guardar partida (cambios sin guardar)",

  // --- Onboarding ---------------------------------------------------------
  "onboarding.1.title": "Extrae las cuentas",
  "onboarding.1.body":
    "Resuelve la ecuación de arriba para ganar minerales. Mantener pulsada " +
    "la cueva (sostén largo) también funciona, pero es una forma más lenta " +
    "de excavar.",
  "onboarding.2.title": "Mantén el combo vivo",
  "onboarding.2.body":
    "Cada respuesta correcta suma a tu combo — cada 10 seguidas multiplica " +
    "tus ganancias en +1. Las respuestas erradas y el sostén de la cueva lo " +
    "rompen, así que responde rápido y no toques la cueva mientras escribes.",
  "onboarding.3.title": "Contrata mineros",
  "onboarding.3.body":
    "Gasta minerales en mejoras y mineros abajo. Los mineros excavan por " +
    "ti automáticamente — incluso con el juego cerrado. Mira los objetivos 🎯 " +
    "para saber qué viene.",
  "onboarding.skip": "Saltar",
  "onboarding.next": "Siguiente",
  "onboarding.start": "¡A minar! ⛏️",
  "onboarding.a11ySkip": "Saltar tutorial",
  "onboarding.a11yNext": "Siguiente paso",
  "onboarding.a11yStart": "Empezar a minar",

  // --- Menu ----------------------------------------------------------------
  "menu.settings": "⚙️ Ajustes",
  "menu.goals": "🎯 Objetivos",
  "menu.records": "📊 Récords",

  // --- Settings ------------------------------------------------------------
  "settings.language": "🌐 Idioma:",
  "lang.auto": "Automático",
  "settings.autosave": "Intervalo de autoguardado (segundos): ",
  "settings.maxNumber": "Valor máximo de la constante en ecuaciones: ",
  "settings.operatorHelp":
    "Mantén pulsado un operador para ver cuánto paga",
  "settings.operatorEquations": "Ecuaciones de {name}",
  "settings.tooltipHard": "Ecuaciones de modo difícil",
  "settings.tooltipStreak": "Ecuaciones de modo racha",
  "settings.tooltipTimed": "Ecuaciones de modo contrarreloj",
  "settings.tooltipEmojiArt": "Arte de emoji (modo ligero)",
  "settings.tooltipShowAll":
    "Mostrar siempre todos los botones de mejora",
  "settings.gainFormula":
    "Minerales por respuesta correcta = respuesta × poder de clic × " +
    "multiplicador de combo, más cualquier bonus de operador. Las ecuaciones " +
    "de modo difícil pagan ×2; las de modo contrarreloj pagan ×2 más si se " +
    "responde a tiempo; una racha encendida paga ×2 más por encima de todo.",
  "settings.op.multiply": "Sin bonus de operador (×1).",
  "settings.op.add": "Sin bonus de operador (×1).",
  "settings.op.subtract":
    "Bonus de operador ×2. Las respuestas siempre son enteras y no negativas.",
  "settings.op.division":
    "Bonus de operador ×10. La división siempre es exacta.",
  "settings.op.percent":
    "Bonus de operador ×3. Solo 10/25/50% — siempre exacto.",
  "settings.op.square":
    "Bonus de operador ×4. La respuesta es a².",
  "settings.op.missing":
    "Bonus de operador ×3. Encuentra el número que va en la «?».",
  "settings.opName.multiply": "multiplicación",
  "settings.opName.add": "suma",
  "settings.opName.subtract": "resta",
  "settings.opName.division": "división",
  "settings.opName.percent": "porcentaje",
  "settings.opName.square": "cuadrado",
  "settings.opName.missing": "número que falta",
  "settings.multiplySymbol": "Símbolo de multiplicación: ",
  "settings.hardMode": "Modo difícil (3 términos ×2): ",
  "settings.hardModeLocked": "🔒 Modo difícil (Motherlode): ",
  "settings.hardModeHelp":
    "Ecuaciones de 3 términos (a ○ b ○ c, de izquierda a derecha) que pagan " +
    "×2 lo normal. El bonus extra viene del tercer término: más aritmética, " +
    "respuestas más grandes.",
  "settings.streakMode": "Modo racha (5 seguidas por ×2): ",
  "settings.streakModeHelp":
    "Responde 5 ecuaciones seguidas y la racha se enciende: cada respuesta " +
    "correcta después paga ×2 por encima de todo lo demás (se acumula con " +
    "los bonuses de operador, modo difícil y contrarreloj). Una respuesta " +
    "errada — o un tiempo agotado — rompe la racha y vuelve a empezar en 0. " +
    "A diferencia del combo, mantener la cueva NO rompe la racha: la regla " +
    "es simplemente no fallar.",
  "settings.timedMode": "Modo contrarreloj (responde en 10s por ×2): ",
  "settings.timedModeHelp":
    "Cada ecuación tiene una ventana de 10 segundos: responde a tiempo y la " +
    "recompensa se multiplica ×2 (se acumula con los bonuses de operador y " +
    "modo difícil). Si se agota el tiempo cuenta como fallo — tu combo baja " +
    "exactamente como con una respuesta errada (la resistencia de combo aún " +
    "aplica) — y sale una nueva. Se acumula con modo difícil: una ecuación " +
    "de 3 términos respondida a tiempo paga ×4 además del bonus de operador.",
  // --- Trucos de cálculo mental (todo: sección de consejos) ---------------
  "settings.tips": "Trucos de cálculo mental",
  "settings.tip.add.title": "Suma por trozos",
  "settings.tip.add.body":
    "Descompón el número hasta llegar a uno redondo: 47 + 28 = 47 + 30 − 2 " +
    "= 75. Redondear arriba y luego restar lo que sobra suele ser más " +
    "rápido que sumar la última cifra.",
  "settings.tip.five.title": "Multiplicar por 5",
  "settings.tip.five.body":
    "×5 es ×10 y luego dividir entre 2: 24 × 5 = 240 ÷ 2 = 120. También " +
    "funciona al revés: divide entre 2 y luego ×10.",
  "settings.tip.nine.title": "Multiplicar por 9",
  "settings.tip.nine.body":
    "×9 es ×10 y luego restar el número: 9 × 7 = 70 − 7 = 63.",
  "settings.tip.dblhalve.title": "Doblar y dividir",
  "settings.tip.dblhalve.body":
    "×4 es doblar dos veces; ×8 es doblar tres. Dividir entre 2 es la otra " +
    "mitad del mismo truco: 36 ÷ 4 = 18 ÷ 2 = 9.",
  "settings.tip.percent.title": "El porcentaje es solo × y luego ÷100",
  "settings.tip.percent.body":
    "Los dos números pueden intercambiar libremente: el 8% de 50 = el 50% " +
    "de 8 = 25. Rápidos: el 50% es dividir entre 2, el 25% es dividir entre " +
    "4, el 10% es mover la coma un lugar a la izquierda.",
  "settings.tip.square.title": "Cuadrados que terminan en 5",
  "settings.tip.square.body":
    "Para a5: multiplica a por a+1 y añade 25 al final. 35² → 3 × 4 = 12, " +
    "luego 1225. 65² → 6 × 7 = 42, luego 4225.",
  "settings.tip.missing.title": "Número faltante: trabaja al revés",
  "settings.tip.missing.body":
    "El número que falta deshace la otra operación: en a + b = ? resta; en " +
    "a × b = ? divide. Pregúntate qué operación esconde el ? y ejecútala en " +
    "sentido inverso.",
  "settings.tip.division.title": "La división es multiplicar al revés",
  "settings.tip.division.body":
    "Lee a ÷ b como «b × cuánto = a?»: 48 ÷ 6 → 6 × 8 = 48, luego 8. Si no " +
    "te suena, recorre los múltiplos de b desde 1.",
  "settings.emojiArt": "Arte de emoji (modo ligero): ",
  "settings.emojiArtHelp":
    "Desactivado (por defecto): mineros, monedas, escombros y el fondo de la " +
    "cueva son sprites de píxeles generados. Activado: emojis planos en su " +
    "lugar — más ligero en dispositivos modestos donde decodificar/renderizar " +
    "PNGs es el cuello de botella. Puro visual; la jugada no cambia.",
  "settings.showAllPurchases":
    "Mostrar siempre todos los botones de mejora: ",
  "settings.showAllPurchasesHelp":
    "Desactivado (por defecto): cada botón de mejora aparece solo cuando " +
    "tuviste suficientes minerales o gemas para comprar su primer nivel — la " +
    "pantalla no se satura a medida que la tienda crece. Los tres botones " +
    "básicos (mejorar poder, comprar un minero, comprar una gema) siempre se " +
    "ven. Activado: se ven todos los botones siempre, bloqueados o no.",
  "settings.onScreenKeypad": "Teclado en pantalla: ",
  "settings.onScreenKeypadHelp":
    "Desactivado (por defecto): la respuesta se escribe con el teclado del " +
    "sistema. Activado: la casilla de respuesta nunca abre el teclado del " +
    "sistema — aparece un teclado de 3 columnas como pestaña junto a la " +
    "lista de mejoras, debajo de la cueva, y las respuestas se escriben " +
    "allí. Se aplica de inmediato, sin necesidad de guardar.",
  "settings.saveCode": "Código de guardado (copia / compartir)",
  "settings.export": "Exportar código",
  "settings.import": "Importar código",
  "settings.importPlaceholder":
    "Pega un código de guardado para importarlo",
  "settings.saveCodeHelp":
    "Exportar te da un código para copiar y compartir; al importar un código " +
    "se reemplaza tu guardado actual por el del código.",
  "settings.cloudSave": "Copia en la nube",
  "settings.cloudSim": " (simulado)",
  "settings.cloudSaveHelp":
    "Respalda tu partida cada pocos minutos y tras cada prestigio en un " +
    "slot privado y exclusivo de este dispositivo. La copia nunca aparece " +
    "en los códigos de guardado y solo reemplaza tu partida cuando la " +
    "restauras tú.",
  "settings.cloudRestore": "Restaurar desde la nube",
  "settings.cloudRestoreDescription":
    "¿Reemplazar tu guardado actual por la copia en la nube? Esto no se " +
    "puede deshacer.",
  "settings.cloudLastSyncOk": "Última sincronización: {when}",
  "settings.cloudLastSyncFailed": "La última sincronización falló — se reintentará sola",
  "settings.cloudNeverSynced": "Sin sincronizar todavía",
  "settings.deleteData": "Borrar mis datos",
  "settings.deleteDataDescription":
    "Elimina tu copia de seguridad en la nube y tu fila de la " +
    "clasificación del servidor. Las compras de este dispositivo se " +
    "conservan, así que la restauración sigue funcionando. No se puede " +
    "deshacer.",
  // --- Cuenta opcional (docs/todo.md "Optional login") --------------
  "settings.account": "Cuenta",
  "settings.accountDefault":
    "Continuar sin cuenta — tu progreso se guarda solo en este " +
    "dispositivo. La cuenta es opcional: te permite llevar tu partida, " +
    "compras y fila de clasificación a un dispositivo nuevo.",
  "settings.accountEmail": "Correo",
  "settings.accountPassword": "Contraseña (8–72 caracteres)",
  "settings.accountSignIn": "Iniciar sesión",
  "settings.accountRegister": "Crear cuenta",
  "settings.accountGoogle": "Continuar con Google",
  "settings.accountApple": "Continuar con Apple",
  "settings.accountEmailTaken":
    "Ese correo ya tiene una cuenta — inicia sesión en su lugar.",
  "settings.accountBadCredentials":
    "Ese correo y contraseña no coinciden. Revísalo o crea una cuenta " +
    "nueva.",
  "settings.accountError":
    "No se pudo alcanzar el servicio de cuentas — comprueba tu conexión " +
    "e inténtalo de nuevo.",
  "settings.accountProviderError": "No se pudo iniciar sesión — inténtalo de nuevo.",
  "settings.accountLinked":
    "Este dispositivo está vinculado a tu cuenta — la partida, las " +
    "compras y la clasificación la siguen a un dispositivo nuevo.",
  "settings.accountSignOut": "Cerrar sesión",
  "settings.deleteDataAccountDescription":
    "Elimina tu cuenta y TODOS los datos vinculados en todos los " +
    "dispositivos — partidas, compras y clasificación — del servidor. " +
    "Se cerrará la sesión en todas partes. No se puede deshacer.",
  "leaderboard.title": "🏆 Top {limit} — el pozo más profundo",
  "leaderboard.name": "Nombre de pantalla (se muestra en la clasificación)",
  "leaderboard.refresh": "Actualizar",
  "leaderboard.loading": "Cargando la clasificación…",
  "leaderboard.unavailable":
    "No disponible ahora — inténtalo de nuevo en un minuto.",
  "leaderboard.youRow": "Tú — puesto #{rank} · {depth}m",
  "leaderboard.notRanked": "Aún no estás en el top {limit} — ¡sigue cavando!",
  "settings.saveButton": "Guardar",
  "settings.resetButton": "Reiniciar",
  "settings.resetDescription":
    "Borrará el guardado actual y volverá al estado inicial.",
  "settings.a11ySaveCode": "Tu código de guardado — selecciona para copiar",
  "settings.analytics": "Estadísticas locales (dep.)",
  "settings.clear": "Borrar",
  "settings.analyticsNote":
    "Guardado solo en este dispositivo — sin red, sin datos personales. " +
    "Borrar lo elimina; un registro nuevo empieza en la próxima apertura.",
  "settings.crash": "Errores recientes (dep.)",

  // --- Cosmetics ------------------------------------------------------------
  "cosmetics.header": "Cosméticos",
  "cosmetics.reroll": "🎲 Nuevo aspecto",
  "cosmetics.outfits": "Ropas (colores aleatorios por cada cambio)",
  "cosmetics.pickaxes": "Picos",
  "cosmetics.themes": "Temas de cueva",
  "cosmetics.themesLocked": "🔒 Temas de cueva (Crystal Kingdom)",
  "cosmetics.themesUnlockedAt": "Se desbloquea en Crystal Kingdom",
  "cosmetics.owned": "Obtenido",
  "cosmetics.a11ySelected": "seleccionado",
  "cosmetics.a11yOwned": "obtenido",
  "cosmetics.a11yGems": "{count} gemas",
  "cosmetics.a11yTheme": "Tema de cueva {name}, {state}",

  // --- Goals ----------------------------------------------------------------
  "goals.unlocks":
    "Desbloquea: {unlock} · Bonus: {bonus} 🪨",
  "goals.achievements": "🏅 Logros",
  "goals.achievementsNote":
    "Bonos únicos — sin desbloqueos, solo confeti.",

  // --- Records ---------------------------------------------------------------
  "records.header":
    "Récords personales, guardados en tu partida — sobreviven a los gastos " +
    "y a los prestigio.",

  // --- Legal section -----------------------------------------------------------
  "legal.heading": "Legal y privacidad",
  "legal.meta": "Versión {version} · Vigente {date}",

  // --- Rewarded ads panel -------------------------------------------------------
  "ads.a11y": "Anuncios recompensados",
  "ads.title":
    "🎬 Anuncios recompensados — mira un video, gana un bonus. Es opcional, " +
    "y cerrar antes solo significa sin bonus.",
  "ads.devSim":
    "⚠️ Compilación de desarrollo: los anuncios son simulados y no se " +
    "reproduce nada realmente.",
  "ads.gemRolls": "💎 Sorteo de gemas — +{count} 💎 por anuncio",
  "ads.leftToday": "{left} de {total} restantes hoy",
  "ads.backTomorrow": "Vuelve mañana.",
  "ads.comboSave": "🔥 Guardar un combo perdido",
  "ads.comboSaveDetail":
    "Restaura un combo de {combo} — expira en {time}",
  "ads.comboSaveNone": "Disponible justo después de perder un combo.",
  "ads.double": "🪨 Duplicar ganancias offline",
  "ads.doubleDetail":
    "Duplica tu último botín: +{count} 🪨",
  "ads.doubleNone": "Aún no hay botín offline para duplicar.",
  "ads.topUp": "⏱️ Recarga offline (+{hours}h)",
  "ads.topUpDetail":
    "El tope de 8h retuvo tu último botín — mira para ganar las próximas " +
    "{hours}h: +{count} 🪨",
  "ads.topUpNone":
    "Disponible cuando un botín offline alcance el tope de 8h.",
  "ads.cap": "Hasta {count} recompensas al día en total.",
  "ads.watching": "Reproduciendo…",
  "ads.watch": "Ver",

  // --- IAP panel -------------------------------------------------------------------
  "iap.a11y": "Compras",
  "iap.title":
    "🛍️ Compras únicas — todas opcionales. El juego es totalmente gratis y " +
    "completable sin ninguna de ellas.",
  "iap.devSim":
    "⚠️ Compilación de desarrollo: las compras son simuladas y no hay " +
    "dinero de por medio.",
  "iap.devRealStoreActive":
    "⚠️ Compilación de desarrollo con facturación REAL de la tienda " +
    "activa: las compras usan la tienda real de este dispositivo.",
  "iap.realStoreToggle":
    "Facturación real de la tienda (APK de depuración: instala primero la " +
    "clave de licencia de Play en este dispositivo — ver " +
    "docs/store-integration.md §2.4)",
  "iap.alsoEarnable":
    "También se puede conseguir en el juego por {count} 💎 — comprar es " +
    "comodidad, no acceso.",
  "iap.groupPickaxes": "Picos",
  "iap.groupOutfits": "Trajes",
  "iap.groupThemes": "Temas de cueva",
  "iap.owned": "Obtenido",
  "iap.buy": "Comprar",
  "iap.restore": "📦 Restaurar compras",
  "iap.restoreDetail":
    "Vuelve a aplicar las compras anteriores de la tienda en este dispositivo.",
  "iap.restoreButton": "Restaurar",

  // --- UI compartida ------------------------------------------------------------
  "ui.close": "Cerrar",
  "ui.areYouSure": "¿Estás seguro?",
  "ui.confirm": "Confirmar",
  "ui.cancel": "Cancelar",
  "a11y.backspace": "Retroceso",
  "a11y.submitAnswer": "Enviar respuesta",
  "a11y.holdToMine": "Mantén pulsado para minar",
  "a11y.digit": "Dígito {d}",
  "a11y.holdToClear": "Mantén pulsado para borrar toda la respuesta",
  "a11y.closeSettings": "Cerrar ajustes",
  "a11y.settings": "Ajustes",

  // --- Footer misc -------------------------------------------------------------------
  "inquiries.subject": "Mines of Doom — comentarios de un jugador",
  "a11y.inquiries":
    "Consultas — abre tu app de correo para contactar al desarrollador",
  "share.achievement": "¡Obtuve «{name}» en Mines of Idle Doomath!",
  "a11y.shareAchievement": "Compartir logro {name}",
  "a11y.mute": "Silenciar sonido",
  "a11y.unmute": "Activar sonido",
};
