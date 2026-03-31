-- Run in Supabase SQL Editor
-- Add labels support to conversations

-- Labels table
CREATE TABLE IF NOT EXISTS labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for chat-label relationship
CREATE TABLE IF NOT EXISTS conversation_labels (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  label_id UUID REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, label_id)
);

-- Disable RLS
ALTER TABLE labels DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_labels DISABLE ROW LEVEL SECURITY;

-- Insert some default labels
INSERT INTO labels (name, color) VALUES
  ('Important', '#ef4444'),
  ('New Customer', '#3b82f6'),
  ('Follow Up', '#f59e0b'),
  ('Order Inquiry', '#10b981'),
  ('Wholesale', '#8b5cf6')
ON CONFLICT DO NOTHING;
