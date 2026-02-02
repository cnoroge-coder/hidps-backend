const frontendClients = new Map(); // userId -> Set(ws)

export function registerFrontend(userId, ws) {
  if (!frontendClients.has(userId)) {
    frontendClients.set(userId, new Set());
  }
  frontendClients.get(userId).add(ws);
}

export function unregisterFrontend(userId, ws) {
  frontendClients.get(userId)?.delete(ws);
}

export function emitToUser(userId, payload) {
  const sockets = frontendClients.get(userId);
  if (!sockets) return;

  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }
}
