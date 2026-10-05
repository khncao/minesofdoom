package expo.modules.admobads

import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAd
import com.google.android.gms.ads.rewardedinterstitial.RewardedInterstitialAdLoadCallback
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Thin AdMob rewarded-INTERSTITIAL bridge (Android).
 *
 * WHY THIS FORMAT, AND NOT A REWARDED AD (2026-10-03). Google Play's
 * Families rules ban "rewarded or opt-in ads that cannot be closed after 5
 * seconds", and a plain AdMob **rewarded** unit cannot be made closeable
 * from the app side: the close button is Google's creative UI with a
 * per-creative 5-30 s countdown until the reward is granted, and
 * `RewardedAd` exposes no dismiss API. That is what got v1.0.10 rejected.
 * (Unity Ads was tried as the fix and failed on device twice — both its
 * rewarded and its interstitial placement served ads with no skip and no
 * way to close; see docs/store-integration.md §0/§1.1.)
 *
 * A **rewarded interstitial** is the format Google's own rejection
 * guidance points at, because only skippable ads are served in it — the
 * player can leave at any point, including inside the first 5 seconds. The
 * price is that it is not opt-in by design (it is meant for app
 * transitions); we only ever show it from a player-tapped "watch" button,
 * so the flow stays opt-in (guardrail 2), and Google's own guide says to
 * present the reward messaging and skip option before showing one.
 *
 * Contract with the JS layer (modules/admob-ads/index.ts ->
 * src/mines_of_doom/adMobAdProvider.ts): every function returns an
 * AdResult string ("rewarded" | "closed" | "error"), never throws for a
 * normal ad outcome, and resolves exactly once.
 */
class AdMobAdsModule : Module() {
  /** The single in-flight show request (the UI disables the button; this is
   *  the backstop against a double tap). */
  private var active: ShowRequest? = null

  private var initialized = false
  private var initRequested = false
  private var childDirected = true
  private var testDeviceIds: List<String> = emptyList()

  /** Mutable per-request state shared between the JS watchdog and the GMA
   *  callbacks: `cancelled` means JS stopped waiting (so we must neither
   *  resolve the promise again NOR show an ad into the void). */
  private class ShowRequest(val promise: Promise) {
    @Volatile var cancelled = false
    @Volatile var settled = false
    @Volatile var earned = false
  }

  override fun definition() = ModuleDefinition {
    Name("AdMobAds")

    // Sent the moment the ad is on screen so JS can stop its load watchdog:
    // the video legitimately runs past any fixed window, and the promise
    // only resolves when the ad ENDS.
    Events("onAdStarted")

    /**
     * Initialize the SDK once per process. Idempotent, and `show` also
     * initializes lazily, so a missing call can never leave the entry
     * points dead.
     *
     * There is NO app-id argument on purpose: GMA 24.6.0's
     * `MobileAds.initialize` only takes (Context) or (Context, listener) —
     * the App ID is read from the merged manifest's
     * `com.google.android.gms.ads.APPLICATION_ID` meta-data, which
     * ./plugins/withAdMobAds.js writes at prebuild from
     * `storeConfig.adMob.appId` (and omits when it is empty, so the
     * repo's "empty = hidden" rule also keeps the App ID out of the APK).
     *
     * @param childDirected true = every request is tagged
     *   TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE with max content rating G —
     *   contextual-only demand, the kid-safe posture (guardrail 6 / the
     *   Play Families rule that ads shown to children must not be
     *   personalized). Set BEFORE initialize so it applies to the very
     *   first request.
     * @param testDeviceIds this device goes on Google's test-device list so
     *   a dev session can never serve a live impression (guardrail 5).
     *   Empty for a production release.
     */
    AsyncFunction("initialize") { childDirected: Boolean, testDeviceIds: Array<String> ->
      this@AdMobAdsModule.childDirected = childDirected
      this@AdMobAdsModule.testDeviceIds = testDeviceIds.toList()
      ensureInitialized()
    }.runOnQueue(Queues.MAIN)

    /**
     * Give the show slot back without waiting for a callback. Cancelling
     * also drops any parked request, so an ad can never pop up for a
     * request the app already gave up on.
     */
    AsyncFunction("cancelShow") {
      synchronized(this@AdMobAdsModule) {
        active?.cancelled = true
        active = null
      }
    }.runOnQueue(Queues.MAIN)

    /**
     * Load then show ONE rewarded interstitial for `adUnitId`.
     *
     * The reward fires on GMA's `OnUserEarnedRewardListener` (the lambda
     * passed to `show`), and dismissal fires on
     * `FullScreenContentCallback.onAdDismissedFullScreenContent`. A
     * dismissal WITHOUT the reward — i.e. the player used the skip — is
     * exactly the path that keeps us Families-compliant, so it resolves
     * "closed" and grants nothing.
     */
    AsyncFunction("showRewardedInterstitial") { adUnitId: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve("error")
        return@AsyncFunction
      }
      ensureInitialized()
      val request: ShowRequest
      synchronized(this@AdMobAdsModule) {
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
        synchronized(this@AdMobAdsModule) {
          first = !request.settled
          request.settled = true
          if (active === request) active = null
        }
        // A cancelled request already resolved on the JS side.
        if (first && !request.cancelled) {
          promise.resolve(result)
        }
      }

      RewardedInterstitialAd.load(
        activity,
        adUnitId,
        AdRequest.Builder().build(),
        object : RewardedInterstitialAdLoadCallback() {
          override fun onAdLoaded(ad: RewardedInterstitialAd) {
            if (request.cancelled) {
              settle("error")
              return
            }
            ad.fullScreenContentCallback = object : FullScreenContentCallback() {
              override fun onAdShowedFullScreenContent() {
                sendEvent("onAdStarted", mapOf("adUnitId" to adUnitId))
              }

              override fun onAdDismissedFullScreenContent() {
                // No reward callback means the player skipped/left early.
                settle(if (request.earned) "rewarded" else "closed")
              }

              override fun onAdFailedToShowFullScreenContent(error: AdError) {
                settle("error")
              }
            }
            ad.show(activity) {
              // OnUserEarnedRewardListener — GMA says the reward was earned.
              request.earned = true
            }
          }

          override fun onAdFailedToLoad(error: LoadAdError) {
            settle("error")
          }
        },
      )
    }.runOnQueue(Queues.MAIN)
  }

  /** Kick off MobileAds initialization once, remembering the params. */
  private fun ensureInitialized() {
    if (initRequested) return
    initRequested = true
    if (initialized) return
    val activity = appContext.currentActivity ?: return
    // Kid-safe posture FIRST: the request configuration must be in effect
    // before any request goes out.
    MobileAds.setRequestConfiguration(
      RequestConfiguration.Builder()
        .setTagForChildDirectedTreatment(
          if (childDirected) {
            RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_TRUE
          } else {
            RequestConfiguration.TAG_FOR_CHILD_DIRECTED_TREATMENT_UNSPECIFIED
          },
        )
        .setMaxAdContentRating(RequestConfiguration.MAX_AD_CONTENT_RATING_G)
        .setTestDeviceIds(testDeviceIds)
        .build(),
    )
    // No app id argument: it comes from the manifest meta-data the
    // withAdMobAds config plugin writes (see the initialize() docs above).
    MobileAds.initialize(activity) {
      initialized = true
    }
  }
}
