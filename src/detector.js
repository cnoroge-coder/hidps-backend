const { createAlert } = require('./supabase');

/**
 * Analyzes logs and triggers alerts for suspicious activity.
 */
async function analyzeLog(agentId, log) {
  const { type, service, message } = log;

  // 1. Detect Failed SSH Logins (Brute Force indicators)
  if (type === 'login' && service === 'sshd') {
    if (message.includes('Failed password') || message.includes('authentication failure')) {
      await createAlert(
        agentId, 
        'Failed SSH Login Attempt', 
        `Multiple failed login attempts detected: ${message}`, 
        'security', 
        'high'
      );
    }
  }

  // 2. Detect Critical File Modifications
  if (type === 'file_monitoring') {
    if (message.includes('/etc/passwd') || message.includes('/etc/shadow')) {
      await createAlert(
        agentId,
        'Critical System File Modified',
        `A critical system file was modified: ${message}`,
        'integrity',
        'critical'
      );
    }
  }

  // 3. Detect Firewall Blocks (Port Scanning indicators)
  if (type === 'firewall') {
    if (message.includes('BLOCK')) {
      // Logic to avoid spamming alerts for every packet could be added here
      // For now, we log it or create a low severity alert
      await createAlert(agentId, 'Firewall Block', message, 'network', 'low');
    }
  }
}

module.exports = { analyzeLog };