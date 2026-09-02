import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Button from "apps/components/Button";
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
 * Errors thrown outside React (e.g. in native module callbacks) still go
 * to the platform logger; capturing those would need ErrorUtils' global
 * handler, which RN 0.76 no longer exposes from the main entry and whose
 * deep import would break the web static export.
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
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const entry = serializeCrash(error);
    return {
      hasError: true,
      name: entry.name,
      message: entry.message,
      stack: entry.stack,
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    // Persist BEFORE re-rendering the fallback: even if the process dies
    // again immediately, the entry is already in AsyncStorage.
    recordCrash(error, errorInfo.componentStack);
  }

  private handleTryAgain = () => {
    this.setState({ hasError: false, name: "", message: "", stack: "" });
  };

  render() {
    const { children } = this.props;
    if (!this.state.hasError) {
      return children;
    }
    const { name, message, stack } = this.state;
    return (
      <View style={localStyles.container}>
        <Text style={localStyles.title}>⛏️ Something went wrong</Text>
        <Text style={localStyles.body}>
          The game hit an unexpected error and stopped rendering. Your save
          is safe — it is written to local storage automatically and will be
          there when the game runs again.
        </Text>
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
        <View style={localStyles.hintRow}>
          <Button title="Try again" onPress={this.handleTryAgain} />
        </View>
        <Text style={localStyles.body}>
          Long-press the error text above to copy it. Recent crashes also
          stay in menu → Settings → “Recent errors (debug)” after a
          restart.
        </Text>
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
    marginTop: 4,
  },
});
