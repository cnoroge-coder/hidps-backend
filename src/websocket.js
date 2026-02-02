const WebSocket = require('ws');
const url = require('url');
const { setAgentOnline, updateAgentStats } = require('./supabase');
const { analyzeLog } = require('./detector');

// Map to store active agent connections: agent_id -> WebSocket
const agents = new Map();
// Map to store active frontend connections: user_id -> WebSocket (for live logs)
const frontends = new Set();

function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', async (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const agentId = parameters.agent_id;
    const userId = parameters.user_id;

    // --- HANDLE AGENT CONNECTION ---
    if (agentId) {
      console.log(`Agent connected: ${agentId}`);
      agents.set(agentId, ws);
      await setAgentOnline(agentId, true);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);

          // Case A: System Stats Report
          if (data.type === 'agent_stats') {
            await updateAgentStats(agentId, data.data);
          } 
          // Case B: Log Event
          else {
            // 1. Run detection logic
            analyzeLog(agentId, data);
            
            // 2. Stream to Frontend (Live Logs)
            broadcastToFrontends({
              type: 'log_stream',
              agent_id: agentId,
              log: data
            });
          }
        } catch (err) {
          console.error('Error processing message:', err);
        }
      });

      ws.on('close', async () => {
        console.log(`Agent disconnected: ${agentId}`);
        agents.delete(agentId);
        await setAgentOnline(agentId, false);
      });
    } 
    
    // --- HANDLE FRONTEND CONNECTION ---
    else if (userId) {
      console.log(`Frontend User connected: ${userId}`);
      frontends.add(ws);

      ws.on('close', () => {
        frontends.delete(ws);
      });
    }
  });

  return { agents, frontends };
}

function broadcastToFrontends(data) {
  const payload = JSON.stringify(data);
  for (const client of frontends) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function sendCommandToAgent(agentId, command, payload = {}) {
  const ws = agents.get(agentId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ command, payload }));
    console.log(`Sent command '${command}' to agent ${agentId}`);
    return true;
  } else {
    console.warn(`Cannot send command. Agent ${agentId} is offline.`);
    return false;
  }
}

module.exports = { setupWebSocketServer, sendCommandToAgent };