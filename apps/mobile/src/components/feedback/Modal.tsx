import React from 'react';
import { Modal as RNModal, type ModalProps as RNModalProps } from 'react-native';

import { ToastOutlet } from './Toast';

export interface ModalProps extends RNModalProps {
  /**
   * Set false for a modal that must never carry a toast — a full-screen photo
   * viewer, say, where the overlay would be intrusive.
   */
  toastOutlet?: boolean;
}

/**
 * `Modal` — React Native's, with a toast outlet inside it.
 *
 * **Import this instead of `Modal` from `react-native`.** RN's `Modal` renders
 * into a separate native window: a presented `UIViewController` on iOS, a
 * `Dialog` on Android. Anything in the React root tree — including the toast
 * mounted by `ToastProvider` — is covered while it is open. Since every sheet
 * in this app is a `Modal`, that hid toasts during exactly the flows they were
 * added for: a failed order, a rejected parent mapping, a role change that did
 * not save.
 *
 * The outlet renders after `children`, so it paints last on Android, and
 * `shadows.medium` gives it elevation. RN already wraps modal children in a
 * screen-sized container view, so the absolutely-positioned toast lands
 * correctly without extra layout.
 *
 * Enforced by `no-restricted-imports` — see `.eslintrc.js`.
 */
export function Modal({ children, toastOutlet = true, ...props }: ModalProps) {
  return (
    <RNModal {...props}>
      {children}
      {toastOutlet && <ToastOutlet />}
    </RNModal>
  );
}
