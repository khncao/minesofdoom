import { memo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import Button from "src/components/Button";
import { useI18n } from "src/hooks/useI18n";
import type { AuthAccountInfo, AuthSigninOutcome } from "../auth";
import type { AccountStatus } from "../hooks/useAccount";
import { isValidEmailInput, isValidPasswordInput } from "../auth";
import {
  type ProviderKind,
  mintIdToken,
  SignInCancelledError,
} from "../signinSdks";
import { styles } from "../styles";

/**
 * The bundle MinesOfDoom hands to the account tab (memo-friendly:
 * the callbacks come from useAccount and are stable; status/account move
 * at sign-in and sign-out only).
 */
export interface AccountSettingsProps {
  /** Provider live on this platform (the section renders only when true
   *  — the "hidden until configured" rule). */
  available: boolean;
  /** Dev build (the labeled in-memory simulation — it never survives a
   *  restart and the section says so). */
  isDevSim: boolean;
  status: AccountStatus;
  /** The account view (null unless signed in) — renders the email line. */
  account: AuthAccountInfo | null;
  /** Register a new account; the section renders the inline outcome.
   *  Stable (useCallback) — safe in memo deps. */
  onRegister: (
    email: string,
    password: string,
  ) => Promise<AuthSigninOutcome>;
  /** Log into an existing account (the single error path — the server
   *  never confirms which half is wrong, the copy must not either). */
  onLogin: (
    email: string,
    password: string,
  ) => Promise<AuthSigninOutcome>;
  /** Sign out (server session killed best-effort + stored token
   *  cleared). */
  onSignOut: () => Promise<void>;
  /** Provider sign-in with a native-SDK idToken (the SDK mints the
   *  token via the OS sheet; the server's sidecar verifies it). */
  onProviderSignIn: (
    kind: ProviderKind,
    idToken: string,
  ) => Promise<AuthSigninOutcome>;
  /** The native sign-in SDKs in THIS build for the running platform
   *  ("hidden until ready" — web is [], android ["google"], ios
   *  both). The section renders one button per kind, nothing else. */
  providerKinds: ProviderKind[];
}

/**
 * Menu "Account" tab (todo: "reorganize menus with clean reimplementation"):
 * the optional account section, lifted out of the settings scroll so the
 * sign-in UI has its own view instead of living below the save code.
 */
const AccountTab = memo(function AccountTab({
  account,
}: {
  account: AccountSettingsProps;
}) {
  return (
    <View style={{ gap: 2, marginTop: 5 }} testID="account-tab">
      <AccountSection account={account} />
    </View>
  );
});

/**
 * The optional account section (docs/todo.md "Optional login", the
 * "UI" bullet): sign in / sign out from settings, rendered only while
 * the provider is available (the "hidden until configured" rule — the
 * same one as the cloud/IAP/ad entry points, and the dev build's
 * labeled simulation is the first thing it exercises on a dev device).
 *
 * The signed-out view leads with the DEFAULT ("continue without an
 * account" — the anonymous device play is untouched, guardrail: F2P
 * parity), then the email/password form, then one button per available
 * native sign-in SDK (Google/Apple — "hidden until ready": the button
 * renders only when `providerKinds` carries that kind for this build).
 */
function AccountSection({ account }: { account: AccountSettingsProps }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!account.available) return null;

  const emailOk = isValidEmailInput(email);
  const passwordOk = isValidPasswordInput(password);

  const submit = async (mode: "login" | "register") => {
    if (busy || !emailOk || !passwordOk) return;
    setBusy(true);
    setFormError(null);
    try {
      const outcome =
        mode === "register"
          ? await account.onRegister(email, password)
          : await account.onLogin(email, password);
      if (outcome.status === "emailTaken") {
        setFormError(t("settings.accountEmailTaken"));
      } else if (
        outcome.status === "badCredentials" ||
        outcome.status === "unverified"
      ) {
        setFormError(t("settings.accountBadCredentials"));
      } else if (outcome.status === "error") {
        setFormError(t("settings.accountError"));
      }
      // "signedIn": the status prop flips to "in" and this view swaps
      // to the signed-in branch on the next render.
    } finally {
      setBusy(false);
    }
  };

  /** One button per native SDK: mint the idToken through the OS sheet,
   *  then hand it to the provider core. A dismissed sheet (cancel) is
   *  NOT an error — the UI stays quiet; everything else gets the
   *  single inline error. */
  const signInWithProvider = async (kind: ProviderKind) => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      let idToken: string;
      try {
        idToken = await mintIdToken(kind);
      } catch (err) {
        if (err instanceof SignInCancelledError) return;
        throw err;
      }
      const outcome = await account.onProviderSignIn(kind, idToken);
      if (outcome.status !== "signedIn") {
        // "unverified" (the server's sidecar refused the idToken — e.g.
        // a dev build without a real Google/Apple account) and
        // "error" (network) share the one retry copy, like the email
        // form's single error path.
        setFormError(t("settings.accountProviderError"));
      }
      // "signedIn": the status prop flips to "in" and this view swaps
      // to the signed-in branch on the next render.
    } catch {
      setFormError(t("settings.accountProviderError"));
    } finally {
      setBusy(false);
    }
  };

  if (account.status === "in" && account.account !== null) {
    return (
      <View style={{ gap: 6, marginTop: 10 }} testID="account-section">
        <Text style={{ ...styles.text, fontWeight: "bold" }}>
          {t("settings.account")}
          {account.isDevSim ? t("settings.cloudSim") : ""}
        </Text>
        {account.account.email.length > 0 && (
          <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
            {account.account.email}
          </Text>
        )}
        <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
          {t("settings.accountLinked")}
        </Text>
        <Button
          title={t("settings.accountSignOut")}
          onPress={() => {
            void account.onSignOut();
          }}
          testId="account-signout"
        />
      </View>
    );
  }

  return (
    <View style={{ gap: 6, marginTop: 10 }} testID="account-section">
      <Text style={{ ...styles.text, fontWeight: "bold" }}>
        {t("settings.account")}
        {account.isDevSim ? t("settings.cloudSim") : ""}
      </Text>
      <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
        {t("settings.accountDefault")}
      </Text>
      <TextInput
        testID="account-email"
        style={{ ...styles.text, ...styles.textInputBox }}
        placeholder={t("settings.accountEmail")}
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        maxLength={254}
      />
      <TextInput
        testID="account-password"
        style={{ ...styles.text, ...styles.textInputBox }}
        placeholder={t("settings.accountPassword")}
        placeholderTextColor="#999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        maxLength={72}
      />
      {formError !== null && (
        <Text style={{ ...styles.text, fontSize: 11, color: "#e07070" }}>
          {formError}
        </Text>
      )}
      <View
        style={{ flexDirection: "row", gap: 6 }}
        testID="account-signin-buttons"
      >
        <Button
          title={t("settings.accountSignIn")}
          disabled={!emailOk || !passwordOk || busy}
          onPress={() => void submit("login")}
          style={{ flex: 1 }}
          testId="account-login"
        />
        <Button
          title={t("settings.accountRegister")}
          disabled={!emailOk || !passwordOk || busy}
          onPress={() => void submit("register")}
          style={{ flex: 1 }}
          testId="account-register"
        />
      </View>
      {account.providerKinds.length > 0 && (
        <View style={{ gap: 4 }} testID="account-provider-buttons">
          {account.providerKinds.map((kind) => (
            <Button
              key={kind}
              title={
                kind === "google"
                  ? t("settings.accountGoogle")
                  : t("settings.accountApple")
              }
              disabled={busy}
              onPress={() => void signInWithProvider(kind)}
              testId={kind === "google" ? "account-google" : "account-apple"}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default AccountTab;
