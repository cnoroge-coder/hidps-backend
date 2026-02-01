// src/alerts/alertService.js
import { supabase } from '../config/supabase.js';
import { evaluateLog } from './ruleEngine.js';
import { sendAlertEmails } from '../email/mailer.js';

export async function processAgentLog(agentId, log) {
  const alert = evaluateLog(log);
  if (!alert) return;

  const { data: createdAlert } = await supabase
    .from('alerts')
    .insert({
      agent_id: agentId,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      alert_type: alert.alert_type
    })
    .select()
    .single();

  await sendAlertEmails(agentId, createdAlert);
}
