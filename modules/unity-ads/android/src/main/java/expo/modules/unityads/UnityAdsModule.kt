package expo.modules.unityads

import com.unity3d.ads.InitializationConfiguration
import com.unity3d.ads.InitializationListener
import com.unity3d.ads.LoadConfiguration
import com.unity3d.ads.LoadListener
import com.unity3d.ads.LogLevel
import com.unity3d.ads.RewardedAd
import com.unity3d.ads.RewardedShowListener
import com.unity3d.ads.ShowConfiguration
import com.unity3d.ads.ShowFinishState
import com.unity3d.ads.UnityAds
import com.unity3d.ads.UnityAdsError
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Thin Unity Ads rewarded bridge (Android).
 *
 * Why hand-written instead of an SDK wrapper: there is no maintained React
 * Native Unity Ads SDK (the npm community wrappers stopped years ago), and the
 * AdMob-mediation route would let Google's own non-skippable rewarded demand
 * backfill a request — the exact Play Families rejection this module exists to
 * avoid. Owning the SDK means 100% of demand is Unity's, so the placement's
 * "Allow skip after 5 seconds" setting (docs/store-integration.md §1) is the
 * only thing that decides how long a player can be held.
 *
 * Contract with the JS layer (modules/unity-ads/index.ts ->
 * src/mines_of_doom/unityAdProvider.ts): every function returns an AdResult
 * string ("rewarded" | "closed" | "error"), never throws for a normal ad
 * outcome, and resolves exactly once.
 */
class UnityAdsModule : Module() {
  /** The single in-flight show request (the UI already disables the button;
   *  this is the backstop against a double tap). */
  private var active: ShowRequest? = null

  private var initialized = false
  private var initRequested = false
  private var gameId: String? = null
  private var nonBehavioral = true
  private var testMode = false

  /** Load calls parked until initialization completes (Unity's init is async
   *  and must finish before a load), each with the block that starts it. */
  private val waitingForInit = mutableListOf<Pair<ShowRequest, () -> Unit>>()


  /** Mutable per-request state shared between the JS watchdog and Unity's
   *  callbacks: `cancelled` means JS stopped waiting (so we must neither
   *  resolve the promise again NOR show an ad into the void). */
  private class ShowRequest(val promise: Promise) {
    @Volatile var cancelled = false
    @Volatile var settled = false
    @Volatile var earned = false
  }

  override fun definition() = ModuleDefinition {
    Name("UnityAds")

    // Sent the moment the ad is on screen, so JS can stop its load watchdog:
    // a rewarded video legitimately runs longer than any load timeout, and
    // the promise only resolves when the ad ENDS (completed → rewarded,
    // skipped → closed, failure → error).
    Events("onAdStarted")

    /**
     * Initialize the SDK once per process. Idempotent and safe to call on every
     * app start; `showRewarded` also initializes lazily, so a missing call
     * can never leave the entry points dead.
     *
     * @param nonBehavioral true = contextual (non-personalized) demand only —
     *   the kid-safe posture (guardrail 6 / Play Families: no interest-based
     *   ads or remarketing for children). Set BEFORE initialize so it applies
     *   to the very first request.
     * @param testMode Unity's test inventory; wired to `!isProdEnvNow()` in
     *   JS so a dev build can never spend/serve live ads.
     */
    AsyncFunction("initialize") { gameId: String, nonBehavioral: Boolean, testMode: Boolean ->
      this@UnityAdsModule.gameId = gameId
      this@UnityAdsModule.nonBehavioral = nonBehavioral
      this@UnityAdsModule.testMode = testMode
      ensureInitialized()
    }.runOnQueue(Queues.MAIN)

    /**
     * Give the show slot back without waiting for a callback.
     *
     * The JS provider owns the only real watchdog (a native call that never
     * answers would otherwise wedge the slot forever and every later "watch"
     * tap would fail with "error"). Cancelling also drops any parked load, so
     * an ad can never pop up for a request the app already gave up on.
     */
    AsyncFunction("cancelShow") {
      synchronized(this@UnityAdsModule) {
        active?.cancelled = true
        active = null
        waitingForInit.clear()
      }
    }.runOnQueue(Queues.MAIN)

    /**
     * Load then show one rewarded ad for `placementId`.
     *
     * The placement must be configured with "Allow skip after 5 seconds" in
     * the Unity dashboard (the Play Families requirement, and the reason we
     * switched providers: the AdMob rewarded unit cannot be made closeable in
     * 5 s). Skipping therefore arrives as SKIPPED with no reward event and
     * resolves "closed" — the player keeps their minerals and we grant
     * nothing, exactly like the old early-close path. A reward is granted
     * only when Unity says so (`onRewarded`); a COMPLETED finish without it
     * still resolves "closed", so we can never mint a reward the ad network
     * didn't earn.
     */
    AsyncFunction("showRewarded") { placementId: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve("error")
        return@AsyncFunction
      }
      ensureInitialized()
      val request: ShowRequest
      synchronized(this@UnityAdsModule) {
        if (active != null) {
          // One ad session at a time; the UI also disables the button.
          promise.resolve("error")
          return@AsyncFunction
        }
        request = ShowRequest(promise)
        active = request
      }

      val settle = { result: String ->
        val first: Boolean
        synchronized(this@UnityAdsModule) {
          first = !request.settled
          request.settled = true
          if (active === request) active = null
        }
        // A cancelled request already resolved on the JS side.
        if (first && !request.cancelled) {
          promise.resolve(result)
        }
      }

      whenInitialized(request) {
        val showListener = object : RewardedShowListener {
          override fun onStarted(ad: RewardedAd) {
            sendEvent("onAdStarted", mapOf("placementId" to placementId))
          }

          override fun onClicked(ad: RewardedAd) = Unit

          override fun onRewarded(ad: RewardedAd) {
            request.earned = true
          }

          override fun onCompleted(ad: RewardedAd, state: ShowFinishState) {
            settle(if (request.earned) "rewarded" else "closed")
          }

          override fun onFailed(ad: RewardedAd, error: UnityAdsError) {
            settle("error")
          }
        }

        RewardedAd.load(
          LoadConfiguration.Builder(placementId).build(),
          object : LoadListener<RewardedAd> {
            override fun onAdLoaded(unityAd: RewardedAd?, error: UnityAdsError?) {
              if (unityAd == null || request.cancelled) {
                settle("error")
                return
              }
              unityAd.show(
                activity,
                ShowConfiguration.Builder().build(),
                showListener,
              )
            }
          },
        )
      }
    }.runOnQueue(Queues.MAIN)
  }

  /** Kick off Unity initialization once, remembering the params. */
  private fun ensureInitialized() {
    if (initRequested) return
    val id = gameId ?: return
    initRequested = true
    if (UnityAds.isInitialized) {
      markInitialized()
      return
    }
    // Kid-safe posture FIRST: contextual-only demand must be in effect before
    // any request goes out.
    if (nonBehavioral) {
      UnityAds.nonBehavioral = true
    }
    val config = InitializationConfiguration.Builder(id)
      .withTestMode(testMode)
      .withLogLevel(if (testMode) LogLevel.DEBUG else LogLevel.DISABLED)
      .build()
    UnityAds.initialize(config, object : InitializationListener {
      override fun onInitializationComplete(error: UnityAdsError?) {
        // Init can fail (no network at cold start); leave the request parked
        // and let the JS watchdog resolve it, so the next tap retries.
        if (error != null) {
          initRequested = false
          return
        }
        markInitialized()
      }
    })
  }

  private fun markInitialized() {
    initialized = true
    val queued = synchronized(this) {
      val copy = waitingForInit.toList()
      waitingForInit.clear()
      copy
    }
    queued.forEach { (request, block) ->
      if (request.cancelled) {
        // JS gave up on this one while we waited.
        synchronized(this) { if (active === request) active = null }
      } else {
        block()
      }
    }
  }

  /**
   * Run the load now if the SDK is up, otherwise park it until initialization
   * completes. A request JS already cancelled is dropped either way — an ad
   * must never pop up for a show the app gave up on.
   */
  private fun whenInitialized(request: ShowRequest, block: () -> Unit) {
    if (initialized || UnityAds.isInitialized) {
      if (request.cancelled) {
        synchronized(this) { if (active === request) active = null }
      } else {
        block()
      }
      return
    }
    synchronized(this) { waitingForInit.add(Pair(request, block)) }
  }
}