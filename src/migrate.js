const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    // Create agents table
    const { error: agentsTableError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS agents (
          id UUID PRIMARY KEY,
          name TEXT,
          owner_id UUID,
          is_online BOOLEAN DEFAULT false,
          last_seen TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          firewall_enabled BOOLEAN DEFAULT false
        );
      `
    });

    if (agentsTableError) {
      console.error('Error creating agents table:', agentsTableError);
    }

    // Create agent_stats table
    const { error: statsTableError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS agent_stats (
          agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
          is_installed BOOLEAN DEFAULT false,
          cpu_usage NUMERIC DEFAULT 0,
          ram_usage NUMERIC DEFAULT 0,
          storage_usage NUMERIC DEFAULT 0,
          firewall_enabled BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `
    });

    if (statsTableError) {
      console.error('Error creating agent_stats table:', statsTableError);
    }

    // Create alerts table
    const { error: alertsTableError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS alerts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
          title TEXT,
          message TEXT,
          alert_type TEXT,
          severity INTEGER,
          resolved BOOLEAN DEFAULT false,
          resolved_by UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          resolved_at TIMESTAMP WITH TIME ZONE
        );
      `
    });

    if (alertsTableError) {
      console.error('Error creating alerts table:', alertsTableError);
    }

    // Create agent_users table
    const { error: agentUsersTableError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS agent_users (
          agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          role TEXT DEFAULT 'admin',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          PRIMARY KEY (agent_id, user_id)
        );
      `
    });

    if (agentUsersTableError) {
      console.error('Error creating agent_users table:', agentUsersTableError);
    }

    // Create monitored_files table
    const { error: monitoredFilesTableError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS monitored_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
          file_path TEXT NOT NULL,
          added_by UUID REFERENCES auth.users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `
    });

    if (monitoredFilesTableError) {
      console.error('Error creating monitored_files table:', monitoredFilesTableError);
    }

    console.log('✅ Migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations().then(() => process.exit(0));