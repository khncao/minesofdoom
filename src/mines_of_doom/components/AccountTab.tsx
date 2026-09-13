import { memo, useState } from "react";
import { TextInput, View } from "react-native";
import { T as Text } from "../textScale";
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
  /** Delete the signed-in account (GDPR: the server erases the account
   *  and everything linked to it, on every device). Resolves true only
   *  when the erasure completed (the inline error otherwise). */
  onDeleteAccount: () => Promise<boolean>;
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
  /** Attach (or change) the email/password mechanism on the signed-in
   *  account — the "email" link of the account merge. Resolves the
   *  updated account, or null on failure (the inline error). */
  onSetPassword: (password: string) => Promise<AuthAccountInfo | null>;
  /** Link a Google/Apple identity to the signed-in account — the
   *  deliberate direction of the email/oauth2 merge (the SDK mints the
   *  idToken; the server's sidecar verifies it). Resolves the updated
   *  account, or null on failure (e.g. the identity is taken by another
   *  account — the server never steals or merges). */
  onLinkProvider: (
    kind: ProviderKind,
    idToken: string,
  ) => Promise<AuthAccountInfo | null>;
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
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The signed-in branch: the new password for the "set a password on
  // this account" flow (todo: merge email + oauth2 accounts).
  const [newPassword, setNewPassword] = useState("");
  // The delete-account confirmation (a deliberate two-step — this is the
  // one irreversible action in the section, so it asks before it acts).
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  if (!account.available) return null;

  const emailOk = isValidEmailInput(email);
  const passwordOk = isValidPasswordInput(password);
  // The confirm field is only required for a NEW account (todo "Add
  // password confirmation if registering"): a matching confirm proves the
  // password was typed deliberately — no re-typed-on-a-wrong-keyboard
  // account that can't be logged into. Sign-in ignores the field.
  const confirmOk = confirm.length > 0 && confirm === password;

  const submit = async (mode: "login" | "register") => {
    if (busy || !emailOk || !passwordOk) return;
    if (mode === "register" && !confirmOk) return;
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

  /** The signed-in merge flows (todo: "check the handling of email and
   *  oauth2 account merging"): attach the email password to an account
   *  that has none yet, or link a provider identity the sign-in-time
   *  merge couldn't (a second Google address, an Apple privacy-proxy
   *  account the player wants joined to their main one). On success the
   *  link flips and the input/button disappears — that IS the feedback;
   *  every failure gets the one inline error. */
  const setAccountPassword = async () => {
    if (busy || !isValidPasswordInput(newPassword)) return;
    setBusy(true);
    setFormError(null);
    try {
      const updated = await account.onSetPassword(newPassword);
      if (updated === null) setFormError(t("settings.accountError"));
    } finally {
      setBusy(false);
    }
  };

  const linkWithProvider = async (kind: ProviderKind) => {
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
      const updated = await account.onLinkProvider(kind, idToken);
      if (updated === null) setFormError(t("settings.accountProviderError"));
    } catch {
      setFormError(t("settings.accountProviderError"));
    } finally {
      setBusy(false);
    }
  };

  /** The irreversible one: the server erases the account + every linked
   *  device's rows and signs the account out everywhere. Success flips
   *  the status prop to "out" (this view swaps to the signed-out
   *  branch); a failed erasure keeps the session and shows the single
   *  inline error. */
  const deleteTheAccount = async () => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const deleted = await account.onDeleteAccount();
      if (!deleted) setFormError(t("settings.accountDeleteError"));
    } finally {
      setBusy(false);
      setDeleteConfirm(false);
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
    const links = account.account.providers;
    const emailLinked =
      links.find((p) => p.name === "email")?.linked === true;
    const unlinkedKinds = account.providerKinds.filter(
      (kind) => links.find((p) => p.name === kind)?.linked !== true,
    );
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
        {!emailLinked && (
          <View style={{ gap: 4 }} testID="account-set-password">
            <TextInput
              testID="account-set-password-input"
              style={{ ...styles.text, ...styles.textInputBox }}
              placeholder={t("settings.accountNewPassword")}
              placeholderTextColor="#999"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              textContentType="newPassword"
              maxLength={72}
            />
            <Button
              title={t("settings.accountSetPassword")}
              disabled={!isValidPasswordInput(newPassword) || busy}
              onPress={() => void setAccountPassword()}
              testId="account-set-password"
            />
          </View>
        )}
        {unlinkedKinds.length > 0 && (
          <View style={{ gap: 4 }} testID="account-link-provider">
            {unlinkedKinds.map((kind) => (
              <Button
                key={kind}
                title={
                  kind === "google"
                    ? t("settings.accountLinkGoogle")
                    : t("settings.accountLinkApple")
                }
                disabled={busy}
                onPress={() => void linkWithProvider(kind)}
                testId={
                  kind === "google" ? "account-link-google" : "account-link-apple"
                }
              />
            ))}
          </View>
        )}
        {formError !== null && (
          <Text style={{ ...styles.text, fontSize: 11, color: "#e07070" }}>
            {formError}
          </Text>
        )}
        <Button
          title={t("settings.accountSignOut")}
          onPress={() => {
            void account.onSignOut();
          }}
          testId="account-signout"
        />
        <View style={{ gap: 4 }} testID="account-delete">
          <Button
            title={t("settings.accountDelete")}
            disabled={busy}
            onPress={() => setDeleteConfirm(true)}
            testId="account-delete"
          />
          {deleteConfirm && (
            <View style={{ gap: 4 }} testID="account-delete-confirm">
              <Text style={{ ...styles.text, fontSize: 11, color: "#bbb" }}>
                {t("settings.deleteDataAccountDescription")}
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Button
                  title={t("settings.accountDeleteYes")}
                  disabled={busy}
                  onPress={() => void deleteTheAccount()}
                  style={{ flex: 1 }}
                  testId="account-delete-yes"
                />
                <Button
                  title={t("settings.accountDeleteKeep")}
                  onPress={() => setDeleteConfirm(false)}
                  style={{ flex: 1 }}
                  testId="account-delete-keep"
                />
              </View>
            </View>
          )}
        </View>
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
      <TextInput
        testID="account-confirm-password"
        style={{ ...styles.text, ...styles.textInputBox }}
        placeholder={t("settings.accountConfirmPassword")}
        placeholderTextColor="#999"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        textContentType="newPassword"
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
          disabled={!emailOk || !passwordOk || !confirmOk || busy}
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
