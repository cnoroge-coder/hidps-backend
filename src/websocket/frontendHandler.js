import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';

export async function handleFrontend(ws, data) {
  try {
    const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
    ws.userId = decoded.sub;
  } catch {
    ws.close();
    return;
  }

  ws.on('message', async msg => {
    const event = JSON.parse(msg);

    if (event.type === 'resolve_alert') {
      await supabase
        .from('alerts')
        .update({
          resolved: true,
          resolved_at: new Date(),
          resolved_by: ws.userId
        })
        .eq('id', event.alert_id);
    }
  });
}
