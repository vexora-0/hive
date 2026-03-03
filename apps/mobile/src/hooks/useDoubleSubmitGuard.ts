import { useCallback, useRef } from 'react';

export function useDoubleSubmitGuard(cooldownMs = 1000) {
  const lastSubmitRef = useRef(0);

  const guard = useCallback(
    (fn: () => void | Promise<void>) => {
      const now = Date.now();
      if (now - lastSubmitRef.current < cooldownMs) return;
      lastSubmitRef.current = now;
      fn();
    },
    [cooldownMs],
  );

  return guard;
}
