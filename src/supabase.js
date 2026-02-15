const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('./email');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper to handle agent connections and auto-registration
async function handleAgentConnection(agentId) {
  try {
    // STEP 1: Create/register agent in database if it doesn't exist
    const { data: existingAgent, error: checkError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .single();

    if (checkError && checkError.code === 'PGRST116') {
      // Agent doesn't exist, create it (only for valid UUIDs)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(agentId)) {
        console.error(`Cannot auto-register agent ${agentId}: not a valid UUID`);
        return false;
      }

      const { data, error } = await supabase
        .from('agents')
        .insert([{
          id: agentId,
          name: `Agent ${agentId.slice(0, 8)}`,
          is_online: true,
          last_seen: new Date().toISOString()
        }])
        .select();

      if (error) {
        console.error(`Error creating agent ${agentId}:`, error);
        return false;
      }
      console.log(`✅ Auto-registering new agent: ${agentId}`);
    } else if (checkError) {
      console.error(`Error checking agent ${agentId}:`, checkError);
      return false;
    }

    // STEP 2: Update agent status to online
    const { error: updateError } = await supabase
      .from('agents')
      .update({
        is_online: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', agentId);

    if (updateError) {
      console.error(`Error updating agent ${agentId} status:`, updateError);
      return false;
    }

    // STEP 3: Now update stats (agent record exists)
    await updateAgentStats(agentId);
    return true;

  } catch (error) {
    console.error(`Error handling agent connection:`, error);
    return false;
  }
}

// Helper to update agent stats
async function updateAgentStats(agentId, stats = {}) {
  const { error } = await supabase
    .from('agent_stats')
    .upsert(
      {
        agent_id: agentId,
        is_installed: true,
        cpu_usage: stats.cpu_usage || 0,
        ram_usage: stats.ram_usage || 0,
        storage_usage: stats.disk_usage || 0,
        firewall_enabled: stats.firewall_enabled || false,
      },
      { onConflict: 'agent_id' }
    );

  if (error) {
    console.error(`Error updating stats for ${agentId}:`, error);
  }
}

// Helper to create an alert
async function createAlert(agentId, title, message, type, severity = 2) {
    console.log(`Creating alert: ${title} for agent ${agentId}, type: ${type}`);
    const { data: alert, error } = await supabase
      .from('alerts')
      .insert({
        agent_id: agentId,
        title,
        message,
        alert_type: type,
        severity,
        resolved: false,
      })
      .select()
      .single();
  
    if (error) {
      console.error(`Error creating alert for ${agentId}:`, error.message);
      return;
    }
  
    // --- EMAIL NOTIFICATION LOGIC ---
    try {
      // 1. Fetch Agent's Owner and Associated Users
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('name, owner_id')
        .eq('id', agentId)
        .single();
  
      if (agentError) throw new Error(`Failed to fetch agent details: ${agentError.message}`);
  
      const { data: users, error: usersError } = await supabase
        .from('agent_users')
        .select('user_id')
        .eq('agent_id', agentId);
  
      if (usersError) throw new Error(`Failed to fetch agent users: ${usersError.message}`);
  
      // 2. Consolidate User IDs
      const userIds = new Set([agent.owner_id]);
      // if (users && users.length > 0) {
      //   users.forEach(u => userIds.add(u.user_id));
      // }
  
      // 3. Fetch User Emails using the Auth Admin API
      const { data: { users: allUsers }, error} = await supabase.auth.admin.listUsers();

      if (usersError) throw new Error(`Failed to fetch user emails: ${usersError.message}`);

      const userEmails = allUsers.filter(user => userIds.has(user.id));
  
      // 4. Send Emails
      const emailSubject = `[HIDPS Alert] ${title} on ${agent.name}`;
      const emailBody = `
  A new alert has been triggered for agent: ${agent.name}
  
  Alert: ${title}
  Details: ${message}
  Severity: ${severity}
  Time: ${new Date(alert.created_at).toUTCString()}
  
  Please log in to the dashboard to review and resolve this alert.
      `;
  
      for (const user of userEmails) {
        await sendEmail(user.email, emailSubject, emailBody.trim());
      }
    } catch (emailError) {
      console.error(`[Email Notification Error] for agent ${agentId}:`, emailError.message);
    }
  }

module.exports = {
  supabase,
  handleAgentConnection,
  updateAgentStats,
  createAlert,
};