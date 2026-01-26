-- Migration: Add get_available_tasks() PostgreSQL function
-- This function filters tasks at the database level (much faster than client-side filtering)
-- Run this in your Supabase SQL Editor

-- ============================================
-- FUNCTION: Get Available Tasks
-- ============================================
-- This function returns tasks where all required inventory items are active
-- Much faster than client-side filtering
CREATE OR REPLACE FUNCTION get_available_tasks()
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    description TEXT,
    requirements TEXT,
    required_inventory_ids JSONB,
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
        t.created_at,
        t.updated_at
    FROM tasks t
    WHERE 
        -- Task has no requirements (always available)
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
    ORDER BY t.created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_available_tasks() TO anon, authenticated;
