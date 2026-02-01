import { supabase } from '../config/supabase.js';
import { registerAgent, unregisterAgent } from '../agents/agentRegistry.js';
import { processAgentLog } from '../alerts/alertService.js';

export async function handleAgent(ws, data) {
  const { agent_id } = data;

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

  ws.on('message', async raw => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.event === 'agent_log') {
      await processAgentLog(agent_id, msg.payload);
    }
  });

  ws.on('close', async () => {
    unregisterAgent(agent_id);
    await supabase
      .from('agents')
      .update({
        is_online: false,
        last_seen: new Date()
      })
      .eq('id', agent_id);
  });
}
