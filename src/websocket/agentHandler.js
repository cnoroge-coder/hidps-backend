import { supabase } from '../config/supabase.js';
import { registerAgent, unregisterAgent } from '../agents/agentRegistry.js';
import { processAgentEvent } from '../alerts/alertService.js';

export async function handleAgent(ws, data) {
  const { agent_id, token } = data;

  // Verify agent token (PoC: token stored in DB or env)
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agent_id)
    .single();

  if (!agent) {
    ws.close();
    return;
  }

  registerAgent(agent_id, ws);

  await supabase
    .from('agents')
    .update({ is_online: true })
    .eq('id', agent_id);

  ws.on('message', msg => {
    const event = JSON.parse(msg);
    processAgentEvent(agent_id, event);
  });

  ws.on('close', async () => {
    unregisterAgent(agent_id);
    await supabase
      .from('agents')
      .update({ is_online: false, last_seen: new Date() })
      .eq('id', agent_id);
  });
}
