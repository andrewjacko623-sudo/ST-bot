-- Migration: Add status tracking columns to tasks table
-- Run this in your Supabase SQL Editor

-- Add status column: 'pending' or 'completed'
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add timestamp for when Daddy assigned the task
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add timestamp for when Jordan marked it complete
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Index for filtering by status (speeds up pending/completed queries)
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- Mark all existing tasks as pending so they surface correctly
UPDATE tasks SET status = 'pending' WHERE status IS NULL;

-- ============================================
-- UPDATE get_available_tasks() to only return pending tasks
-- ============================================
DROP FUNCTION IF EXISTS get_available_tasks();

CREATE OR REPLACE FUNCTION get_available_tasks()
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    description TEXT,
    requirements TEXT,
    required_inventory_ids JSONB,
    status TEXT,
    assigned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.name,
        t.description,
        t.requirements,
        t.required_inventory_ids,
        t.status,
        t.assigned_at,
        t.created_at,
        t.updated_at
    FROM tasks t
    WHERE
        -- Only return pending tasks
        (t.status = 'pending' OR t.status IS NULL)
        AND (
            -- Task has no inventory requirements (always available)
            (t.required_inventory_ids IS NULL OR t.required_inventory_ids = '[]'::jsonb)
            OR
            -- All required inventory items are active
            NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(t.required_inventory_ids) AS req_id
                WHERE req_id::uuid NOT IN (
                    SELECT i.id
                    FROM inventory i
                    WHERE i.is_active = true
                )
            )
        )
    ORDER BY t.assigned_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION get_available_tasks() TO anon, authenticated;
