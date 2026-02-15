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

// Helper to update agent online status
async function setAgentOnline(agentId, isOnline) {
  // First, check if agent exists
  const { data: existingAgent, error: selectError } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .single();

  if (selectError && selectError.code !== 'PGRST116') { // PGRST116 is "not found"
    console.error(`Error checking agent ${agentId}:`, selectError.message);
    return;
  }

  if (!existingAgent) {
    // Agent doesn't exist, try to auto-register it
    console.log(`Auto-registering new agent: ${agentId}`);
    
    // Get the first user as default owner
    const { data: firstUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single();

    if (userError) {
      console.error(`Error getting default user for agent ${agentId}:`, userError.message);
      return;
    }

    // Insert the agent
    const { error: insertError } = await supabase
      .from('agents')
      .insert({
        id: agentId,
        name: `Agent ${agentId.slice(0, 8)}`, // Use first 8 chars of ID as name
        owner_id: firstUser.id,
      });

    if (insertError) {
      console.error(`Error auto-registering agent ${agentId}:`, insertError.message);
      return;
    }

    // Also insert into agent_stats
    const { error: statsError } = await supabase
      .from('agent_stats')
      .insert({
        agent_id: agentId,
      });

    if (statsError) {
      console.error(`Error creating stats for agent ${agentId}:`, statsError.message);
    }
  }

  // Now update the agent status
  const { error } = await supabase
    .from('agents')
    .update({
      is_online: isOnline,
      last_seen: isOnline ? new Date() : undefined,
    })
    .eq('id', agentId);

  if (error) {
    console.error(`Error updating agent ${agentId} status:`, error.message);
  }

  const { error2 } = await supabase
    .from('agent_stats')
    .update({
      is_installed: true,
    })
    .eq('agent_id', agentId);

  if (error2) {
    console.error(`Error updating agent ${agentId}:`, error2.message);
  }
}

// Helper to update system stats (CPU/RAM)
async function updateAgentStats(agentId, stats) {
  const { error } = await supabase
    .from('agent_stats')
    .upsert(
      {
        agent_id: agentId,
        cpu_usage: stats.cpu_usage,
        ram_usage: stats.ram_usage,
        storage_usage: stats.disk_usage,
        // We do NOT update firewall_enabled here to avoid overwriting the user's desired state
      },
      { onConflict: 'agent_id' }
    );

  if (error) console.error(`Error updating stats for ${agentId}:`, error.message);
}

// Helper to create an alert
async function createAlert(agentId, title, message, type, severity = 2) {
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
  setAgentOnline,
  updateAgentStats,
  createAlert,
};