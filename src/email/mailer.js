import nodemailer from 'nodemailer';
import { supabase } from '../config/supabase.js';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendAlertEmails(agentId, alert) {
  const { data: users } = await supabase
    .from('agent_users')
    .select('user_id')
    .eq('agent_id', agentId);

  // fetch emails from auth.users via admin API if needed
}
