# HIDPS Architecture Overview (Backend-Focused)

## System Components

The system consists of four primary components:

1. **Linux Agent (Python)**
2. **Backend Server (Node.js)**
3. **Supabase (Auth, Database, Realtime)**
4. **Frontend (Web App)**

Each component has a clearly defined responsibility. The backend acts as the **central authority and mediator** between agents, Supabase, and the frontend.

---

## Core Architectural Principles

1. **Supabase is the source of truth for durable state**

   * Agent metadata
   * Agent stats
   * Alerts
   * Monitored files
   * Agent–user relationships

2. **The backend is the only component that:**

   * Talks directly to agents
   * Analyzes logs
   * Issues commands to agents
   * Generates alerts
   * Sends emails

3. **Logs are streams, not state**

   * Logs are never stored in Supabase
   * Logs flow through WebSockets only
   * Only significant events produce alerts, which are persisted

4. **Agents never talk to Supabase**

   * All Supabase access uses the backend service role key
   * Agents only communicate with the backend

---

## Communication Channels

### 1. Agent → Backend (WebSocket – Required)

Agents connect to the backend using a persistent WebSocket connection after installation.

The agent streams **normalized log events** in JSON format:

```json
{
  "timestamp": "ISO-8601",
  "type": "system_usage | process | firewall | login | file_monitoring | agent_info",
  "service": "psutil | watchdog | sshd | ufw | kernel | sudo",
  "message": "string or structured object"
}
```

Agent responsibilities:

* Stream logs continuously
* Send heartbeats
* Execute commands received from backend (firewall, file monitoring)
* Report system usage periodically

---

### 2. Backend → Agent (WebSocket Commands)

The backend issues commands to agents in response to:

* Supabase state changes
* Frontend direct requests

Examples:

* Enable / disable firewall
* Add / remove monitored file paths
* Fetch firewall rules
* Fetch firewall status

Commands are **idempotent** and represent **desired state**, not imperative sequences.

---

### 3. Frontend ↔ Supabase (Realtime)

The frontend:

* Reads almost all data via Supabase Realtime
* Writes desired state changes to Supabase tables

The frontend does **not** connect to the backend for most operations.

Examples:

* Toggle firewall state → update `agent_stats.firewall_enabled`
* Add monitored file → insert into `monitored_files`
* Resolve alert → update `alerts.resolved`

Supabase Realtime propagates these changes.

---

### 4. Backend ↔ Supabase (Realtime Listener)

The backend subscribes to Supabase Realtime events and reacts to state changes:

| Table             | Backend Action                    |
| ----------------- | --------------------------------- |
| `agent_stats`     | Apply firewall state changes      |
| `monitored_files` | Add/remove file watchers on agent |
| `agents`          | Track online/offline status       |
| `alerts`          | Trigger email notifications       |

The backend deduplicates events and applies commands only when state actually changes.

---

### 5. Backend → Frontend (WebSocket – Logs & Commands Only)

The backend maintains WebSocket connections with frontend clients **only for streaming data that is not persisted**:

* Live logs
* Firewall rule listings
* On-demand agent responses

Frontend WebSocket usage:

* Subscribe to agent log streams
* Request firewall rules
* Receive command results

This channel is **not** used for durable state.

---

## Alert Generation Flow

1. Agent streams logs to backend
2. Backend parses logs
3. Detection logic evaluates logs
4. If suspicious:

   * Create alert record in Supabase
   * Emit alert via Supabase Realtime
   * Send email notifications
5. Frontend receives alert via Supabase Realtime

Only alerts are persisted — raw logs are discarded.

---

## Agent Installation Flow

1. User downloads agent package
2. Runs:

```bash
sudo ./install.sh --agent-id <agent_id>
```

3. Agent:

   * Registers with backend
   * Establishes WebSocket connection
4. Backend:

   * Marks agent as installed
   * Sets `agents.is_online = true`
   * Initializes agent state
5. Agent begins streaming logs

---

## Supabase Schema Role

Supabase tables represent **current system state**, not events:

* `agents`: identity, ownership, online status
* `agent_stats`: system usage, firewall status
* `alerts`: detected security events
* `monitored_files`: file monitoring configuration
* `agent_users`: access control

Supabase Realtime is used to synchronize this state with frontend clients.

---

## Important Constraints

* Logs must never be written to Supabase
* Agents must never have Supabase credentials
* Backend must deduplicate Supabase events
* Commands must be idempotent
* Frontend never communicates directly with agents

---

## Implementation Guidance for Backend (Node.js)

When implementing the backend:

* Use WebSockets for agent connections
* Use Supabase Realtime listeners for state changes
* Maintain in-memory maps:

  * agent_id → WebSocket
  * user_id → frontend WebSocket(s)
* Separate:

  * **Stream handling**
  * **Detection logic**
  * **Supabase persistence**
* Treat Supabase as a state database, not a message queue

---

## Summary

This architecture intentionally separates:

* **Streams** (WebSockets)
* **State** (Supabase)
* **Decisions** (Backend)
* **Presentation** (Frontend)

## Supabase Schema

```sql
-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.agent_stats (
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  agent_id uuid NOT NULL,
  is_installed boolean NOT NULL DEFAULT false,
  cpu_usage numeric NOT NULL DEFAULT '0'::numeric,
  ram_usage numeric NOT NULL DEFAULT '0'::numeric,
  storage_usage numeric NOT NULL DEFAULT '0'::numeric,
  firewall_enabled boolean DEFAULT false,
  CONSTRAINT agent_stats_pkey PRIMARY KEY (agent_id),
  CONSTRAINT agent_stats_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id)
);
CREATE TABLE public.agent_users (
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  agent_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'admin'::text,
  CONSTRAINT agent_users_pkey PRIMARY KEY (agent_id, user_id),
  CONSTRAINT agent_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT agent_users_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id)
);
CREATE TABLE public.agents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL DEFAULT 'unnamed'::text,
  owner_id uuid NOT NULL DEFAULT gen_random_uuid(),
  last_seen timestamp without time zone,
  is_online boolean DEFAULT false,
  CONSTRAINT agents_pkey PRIMARY KEY (id),
  CONSTRAINT agents_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);
CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp without time zone,
  agent_id uuid NOT NULL,
  title text,
  message text,
  alert_type text,
  severity smallint,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  CONSTRAINT alerts_pkey PRIMARY KEY (id),
  CONSTRAINT alerts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id),
  CONSTRAINT alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES auth.users(id)
);
CREATE TABLE public.monitored_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  agent_id uuid NOT NULL,
  file_path text NOT NULL,
  added_by uuid NOT NULL,
  CONSTRAINT monitored_files_pkey PRIMARY KEY (id),
  CONSTRAINT monitored_files_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id),
  CONSTRAINT monitored_files_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id)
);
```

## Frontend (Web App)

- https://hidps-frontend.vercel.app