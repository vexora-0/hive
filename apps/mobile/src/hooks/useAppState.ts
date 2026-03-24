import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useAppState(onChange: (state: AppStateStatus) => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      onChangeRef.current(state);
    });
    return () => subscription.remove();
  }, []);
}

export function useOnForeground(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useAppState((state) => {
    if (state === 'active') {
      callbackRef.current();
    }
  });
}
