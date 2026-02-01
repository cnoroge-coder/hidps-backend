import WebSocket from 'ws';
import { handleAgent } from './agentHandler.js';
import { handleFrontend } from './frontendHandler.js';

export function startWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    ws.once('message', msg => {
      const data = JSON.parse(msg);

      if (data.type === 'agent_auth') {
        handleAgent(ws, data);
      } else if (data.type === 'user_auth') {
        handleFrontend(ws, data);
      } else {
        ws.close();
      }
    });
  });
}
