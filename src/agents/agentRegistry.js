const agents = new Map(); // agentId -> ws

export function registerAgent(agentId, ws) {
  agents.set(agentId, ws);
}

export function unregisterAgent(agentId) {
  agents.delete(agentId);
}

export function getAgent(agentId) {
  return agents.get(agentId);
}
