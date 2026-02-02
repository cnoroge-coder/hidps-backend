// src/mock/mockAgent.js
import { processAgentLog } from '../alerts/alertService.js';

/**
 * Starts a mock agent that emits events to the backend
 * exactly like a real agent would.
 */
export function startMockAgent(agentId = 'agent_001') {
  console.log(`[MockAgent] Starting mock agent for ${agentId}`);

  // Simulate login failures every 15 seconds
  setInterval(() => {
    processAgentLog(agentId, {
      type: 'login',
      service: 'sshd',
      message: 'Failed password for invalid user root',
      timestamp: new Date().toISOString(),
    });
  }, 15000);

  // Simulate high CPU usage every 30 seconds
  setInterval(() => {
    processAgentLog(agentId, {
      type: 'system_usage',
      service: 'psutil',
      message: { cpu_usage: 95, ram_usage: 80, disk_usage: 60 },
      timestamp: new Date().toISOString(),
    });
  }, 30000);

  // Simulate a file modification every 45 seconds
  setInterval(() => {
    processAgentLog(agentId, {
      type: 'file_monitoring',
      service: 'watchdog',
      message: '/home/testuser/important.txt modified',
      timestamp: new Date().toISOString(),
    });
  }, 45000);
}
