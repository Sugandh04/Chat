// Native stub: calls are web-only for now. The real implementation is in calls.web.tsx.
import React from "react";

export interface Calls {
  supported: boolean;
  busy: boolean;
  start: (chatId: string, peerId: string, peerName: string, video: boolean) => void;
}

const none: Calls = { supported: false, busy: false, start: () => {} };

export const useCalls = () => none;
export function CallProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
export function CallOverlay() {
  return null;
}
