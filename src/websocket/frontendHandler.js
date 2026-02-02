import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase.js';
import {
  registerFrontend,
  unregisterFrontend
} from './frontendRegistry.js';

export async function handleFrontend(ws, data) {
  let userId;

  try {
    const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
    userId = decoded.sub;
  } catch {
    ws.close();
    return;
  }

  registerFrontend(userId, ws);

  ws.on('message', async raw => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'resolve_alert') {
      await supabase
        .from('alerts')
        .update({
          resolved: true,
          resolved_at: new Date(),
          resolved_by: userId
        })
        .eq('id', msg.alert_id);
    }
  });

  ws.on('close', () => {
    unregisterFrontend(userId, ws);
  });
}
