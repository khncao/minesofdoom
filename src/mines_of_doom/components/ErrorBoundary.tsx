import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Button from "src/components/Button";
import { getLocale, translate } from "src/utils/i18n/i18n";
import type { Vars } from "src/utils/i18n/en";
import {
  formatCrashContext,
  snapshotCrashContext,
} from "../crashContext";
import { serializeCrash } from "../crashLog";
import { recordCrash } from "../crashLogging";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  /** False until a crash is caught. Kept as a flag (not a `| null` state)
   *  so the class stays assignable as a JSX component. */
  hasError: boolean;
  name: string;
  message: string;
  stack: string;
  /** Formatted crash-context trail (what the game was doing), "" for
   *  pre-context crashes. */
  context: string;
};

/**
 * Crash screen (plan "Adjust") — the diagnostic half of the fix for the
 * unreproducible Android Hermes
 * `ReferenceError: Property 'describe' doesn't exist`.
 *
 * Release builds have no red box, so before this a render crash on a real
 * device was a silent white screen with the trace gone forever. Now the
 * boundary catches the error, shows its full (selectable, long-press to
 * copy) stack, and records it through `recordCrash` into the persisted
 * "crashLog" ring — which also surfaces in Settings → "Recent errors"
 * after a restart.
 *
 * Scope note: this catches render/lifecycle errors in the game screen
 * subtree (the suspected class — an expo-router/native-stack interaction).
 * Errors thrown OUTSIDE React (native-stack listeners, timers, native
 * module callbacks) are additionally caught by the ErrorUtils global
 * handler wrapper (hooks/useGlobalCrashCapture.ts, installed from
 * src/app/index.tsx) and recorded into the same crash log with
 * source: "global" — that layer is the one that can see the suspected
 * Android `describe` crash if it happens outside a render.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    name: "",
    message: "",
    stack: "",
    context: "",
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const entry = serializeCrash(error);
    return {
      hasError: true,
      name: entry.name,
      message: entry.message,
      stack: entry.stack,
      // The trail at the moment of the crash — "what was happening" next
      // to the trace is what makes the next on-device occurrence readable
      // without a reproduction (the Android `describe` bug).
      context: formatCrashContext(snapshotCrashContext()),
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    // Persist BEFORE re-rendering the fallback: even if the process dies
    // again immediately, the entry is already in AsyncStorage. (Default
    // source "render" distinguishes it from global-handler captures in
    // the Settings list.)
    recordCrash(error, errorInfo.componentStack, "render");
  }

  private handleTryAgain = () => {
    this.setState({
      hasError: false,
      name: "",
      message: "",
      stack: "",
      context: "",
    });
  };

  // Native release builds can't restart themselves, but the web build is
  // a static page — a full reload is the cleanest recovery after a caught
  // crash (the save is already on disk).
  private handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    const { children } = this.props;
    if (!this.state.hasError) {
      return children;
    }
    const { name, message, stack } = this.state;
    // Class component: no hooks — translate directly against the current
    // locale (the crash screen renders once; a language change can't
    // happen while it's up without a restart).
    const t = (key: Parameters<typeof translate>[0], vars?: Vars) =>
      translate(key, getLocale(), vars);
    return (
      <View style={localStyles.container}>
        <Text style={localStyles.title}>{t("error.title")}</Text>
        <Text style={localStyles.body}>{t("error.body")}</Text>
        <Text style={localStyles.heading}>
          {name}
          {message.length > 0 ? `: ${message}` : ""}
        </Text>
        {stack.length > 0 && (
          <View style={localStyles.stackBox}>
            {/* selectable: long-press to copy the full trace out of the
                device (the red box is a dev-only surface). */}
            <Text style={localStyles.stackText} selectable>
              {stack}
            </Text>
          </View>
        )}
        {this.state.context.length > 0 && (
          <View style={localStyles.stackBox}>
            <Text style={localStyles.contextText} selectable>
              {`${t("error.contextHeading")}\n${this.state.context}`}
            </Text>
          </View>
        )}
        <View style={localStyles.hintRow}>
          <Button title={t("error.tryAgain")} onPress={this.handleTryAgain} />
          {Platform.OS === "web" && (
            <Button title={t("error.reloadPage")} onPress={this.handleReload} />
          )}
        </View>
        <Text style={localStyles.body}>{t("error.hint")}</Text>
      </View>
    );
  }
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2f2f2f",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
    userSelect: "none",
  },
  body: {
    color: "#ccc",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    userSelect: "none",
  },
  heading: {
    color: "#ff8a66",
    fontSize: 14,
    fontWeight: "bold",
    alignSelf: "stretch",
    textAlign: "center",
    userSelect: "auto",
  },
  stackBox: {
    alignSelf: "stretch",
    backgroundColor: "#1f1f1f",
    borderColor: "#555",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxHeight: 320,
  },
  stackText: {
    color: "#9fd69f",
    fontSize: 11,
    lineHeight: 16,
  },
  hintRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 4,
  },
  contextText: {
    color: "#d6c48f",
    fontSize: 11,
    lineHeight: 16,
  },
});
