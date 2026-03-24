export function broadcastRealtimeUpdate(message: unknown): void {
  // Stub for future websocket fan-out.
  console.log("[websocket] update", JSON.stringify(message));
}
