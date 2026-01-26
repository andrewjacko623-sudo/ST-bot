-- Migration: Add required_inventory_ids column to tasks table
-- Run this in your Supabase SQL Editor if you already have a tasks table

-- Add new column for inventory IDs (JSON array)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS required_inventory_ids JSONB DEFAULT '[]'::jsonb;

-- Create index for JSONB queries (improves performance)
CREATE INDEX IF NOT EXISTS idx_tasks_required_inventory_ids ON tasks USING GIN (required_inventory_ids);

-- Note: The old 'requirements' TEXT column is kept for backward compatibility
-- You can remove it later if you want by running:
-- ALTER TABLE tasks DROP COLUMN IF EXISTS requirements;
