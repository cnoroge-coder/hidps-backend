// src/alerts/alertService.js
import { supabase } from '../config/supabase.js';
import { evaluateLog } from './ruleEngine.js';
import { sendAlertEmails } from '../email/mailer.js';

export async function processAgentLog(agentId, log) {
  const alert = evaluateLog(log);
  if (!alert) return;

  const { data: created } = await supabase
    .from('alerts')
    .insert({
      agent_id: agentId,
      ...alert
    })
    .select()
    .single();

  const { data: users } = await supabase
    .from('agent_users')
    .select('user_id')
    .eq('agent_id', agentId);

  for (const { user_id } of users) {
    emitToUser(user_id, {
      event: 'alert_created',
      data: created
    });
  }
  await sendAlertEmails(agentId, created);
}
