import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('[websocket] client connected');
  ws.send(JSON.stringify({ type: 'welcome', message: 'Stellar Indexer Real-time Stream' }));
});

export function broadcastRealtimeUpdate(message: any): void {
  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
  console.log("[websocket] broadcasted update to", wss.clients.size, "clients");
}
