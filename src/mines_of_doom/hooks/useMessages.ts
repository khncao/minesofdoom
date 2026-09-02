import { useCallback, useRef, useState } from "react";

export function useMessages() {
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayMessage = useCallback(
    (message: string, timeout: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setShowMessage(null), timeout);
      setShowMessage(message);
    },
    [],
  );

  return { showMessage, displayMessage };
}
