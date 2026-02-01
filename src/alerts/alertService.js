import { supabase } from '../config/supabase.js';
import { evaluate } from './ruleEngine.js';
import { sendAlertEmails } from '../email/mailer.js';

export async function processAgentEvent(agentId, event) {
  const alert = evaluate(event);
  if (!alert) return;

  const { data } = await supabase
    .from('alerts')
    .insert({
      agent_id: agentId,
      ...alert
    })
    .select()
    .single();

  await sendAlertEmails(agentId, data);
  // Emit to connected frontends (left as exercise)
}
