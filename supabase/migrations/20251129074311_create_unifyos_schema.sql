/*
  # UnifyOS Production Database Schema
  
  ## Overview
  Creates the complete database schema for UnifyOS with proper security and indexing.
  
  ## Tables Created
  
  ### Users Table
  - `id` (uuid, primary key)
  - `email` (text, unique)
  - `name` (text)
  - `plan` (enum: FREE, PRO, BUSINESS)
  - `created_at` (timestamp)
  - `updated_at` (timestamp)
  
  ### App Tokens Table
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `app_name` (text) - slack, gmail, calendar, etc
  - `access_token` (text) - encrypted OAuth token
  - `refresh_token` (text) - encrypted
  - `expires_at` (timestamp)
  - `scope` (text)
  - `metadata` (jsonb)
  - `connected` (boolean)
  - `last_used_at` (timestamp)
  
  ### Workflows Table
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `name` (text)
  - `description` (text)
  - `trigger_app` (text)
  - `trigger_event` (text)
  - `trigger_config` (jsonb)
  - `actions` (jsonb array)
  - `enabled` (boolean)
  - `execution_count` (integer)
  - `last_executed_at` (timestamp)
  
  ### Workflow Executions Table
  - `id` (uuid, primary key)
  - `workflow_id` (uuid, foreign key)
  - `status` (enum: PENDING, RUNNING, SUCCESS, FAILED)
  - `trigger_data` (jsonb)
  - `results` (jsonb)
  - `error` (text)
  - `started_at` (timestamp)
  - `completed_at` (timestamp)
  - `duration` (integer milliseconds)
  
  ### Notifications Table
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key)
  - `app_name` (text)
  - `app_icon` (text)
  - `title` (text)
  - `message` (text)
  - `priority` (enum: LOW, MEDIUM, HIGH)
  - `read` (boolean)
  - `metadata` (jsonb)
  - `external_id` (text)
  - `created_at` (timestamp)
  
  ## Security
  - All tables have RLS enabled
  - Users can only access their own data
  - Proper indexes for performance
  - Foreign key constraints
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create user plan enum
DO $$ BEGIN
  CREATE TYPE user_plan AS ENUM ('FREE', 'PRO', 'BUSINESS');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create execution status enum
DO $$ BEGIN
  CREATE TYPE execution_status AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create notification priority enum
DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  name text,
  plan user_plan DEFAULT 'FREE' NOT NULL,
  email_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  last_login_at timestamptz
);

-- App tokens table
CREATE TABLE IF NOT EXISTS app_tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_name text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  metadata jsonb DEFAULT '{}'::jsonb,
  connected boolean DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, app_name)
);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_app text NOT NULL,
  trigger_event text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb,
  actions jsonb DEFAULT '[]'::jsonb,
  enabled boolean DEFAULT true,
  execution_count integer DEFAULT 0,
  last_executed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status execution_status DEFAULT 'PENDING',
  trigger_data jsonb DEFAULT '{}'::jsonb,
  results jsonb,
  error text,
  started_at timestamptz DEFAULT now() NOT NULL,
  completed_at timestamptz,
  duration integer
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_name text NOT NULL,
  app_icon text,
  title text NOT NULL,
  message text NOT NULL,
  priority notification_priority DEFAULT 'MEDIUM',
  read boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  external_id text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_app_tokens_user_id ON app_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_app_tokens_app_name ON app_tokens(app_name);
CREATE INDEX IF NOT EXISTS idx_app_tokens_connected ON app_tokens(user_id, connected);
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_enabled ON workflows(user_id, enabled);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- App tokens policies
CREATE POLICY "Users can view own app tokens"
  ON app_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own app tokens"
  ON app_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own app tokens"
  ON app_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own app tokens"
  ON app_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Workflows policies
CREATE POLICY "Users can view own workflows"
  ON workflows FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workflows"
  ON workflows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows"
  ON workflows FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows"
  ON workflows FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Workflow executions policies
CREATE POLICY "Users can view own workflow executions"
  ON workflow_executions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = workflow_executions.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert workflow executions"
  ON workflow_executions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workflows
      WHERE workflows.id = workflow_executions.workflow_id
      AND workflows.user_id = auth.uid()
    )
  );

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DO $$ BEGIN
  CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_app_tokens_updated_at BEFORE UPDATE ON app_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;