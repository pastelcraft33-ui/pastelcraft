// Only connection health is shared; no credentials or message content is retained.
let connected = false;

export function isChatRealtimeConnected() {
  return connected;
}

export function setChatRealtimeConnected(value: boolean) {
  const recovered = value && !connected;
  connected = value;
  if (recovered) window.dispatchEvent(new Event("chat-reconnected"));
}

export function shouldRefreshChat(immediate: boolean, realtimeConnected: boolean, elapsedMs: number) {
  return immediate || !realtimeConnected || elapsedMs >= 60_000;
}
