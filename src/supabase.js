const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Helper to update agent online status
async function setAgentOnline(agentId, isOnline) {
  const { error } = await supabase
    .from('agents')
    .update({ 
      is_online: isOnline, 
      last_seen: isOnline ? new Date() : undefined 
    })
    .eq('id', agentId);
  
  if (error) console.error(`Error updating agent ${agentId} status:`, error.message);
}

// Helper to update system stats (CPU/RAM)
async function updateAgentStats(agentId, stats) {
  const { error } = await supabase
    .from('agent_stats')
    .upsert({
      agent_id: agentId,
      cpu_usage: stats.cpu_usage,
      ram_usage: stats.ram_usage,
      storage_usage: stats.disk_usage,
      // We do NOT update firewall_enabled here to avoid overwriting the user's desired state
    }, { onConflict: 'agent_id' });

  if (error) console.error(`Error updating stats for ${agentId}:`, error.message);
}

// Helper to create an alert
async function createAlert(agentId, title, message, type, severity = 'medium') {
  const { error } = await supabase
    .from('alerts')
    .insert({
      agent_id: agentId,
      title,
      message,
      alert_type: type,
      severity,
      resolved: false
    });

  if (error) console.error(`Error creating alert for ${agentId}:`, error.message);
}

module.exports = {
  supabase,
  setAgentOnline,
  updateAgentStats,
  createAlert
};