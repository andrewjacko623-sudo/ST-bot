-- Supabase Table Schema
-- Tables for Tasks and Inventory

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    requirements TEXT,  -- Kept for backward compatibility
    required_inventory_ids JSONB DEFAULT '[]'::jsonb,  -- Array of inventory IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for tasks
CREATE INDEX IF NOT EXISTS idx_tasks_name ON tasks(name);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_required_inventory_ids ON tasks USING GIN (required_inventory_ids);

-- ============================================
-- INVENTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for inventory
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(name);
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory(created_at DESC);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on both tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- TASKS POLICIES: Allow public read/write (adjust based on your needs)
CREATE POLICY "Allow public read access for tasks" ON tasks
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert for tasks" ON tasks
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update for tasks" ON tasks
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete for tasks" ON tasks
    FOR DELETE
    USING (true);

-- INVENTORY POLICIES: Allow public read/write (adjust based on your needs)
CREATE POLICY "Allow public read access for inventory" ON inventory
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert for inventory" ON inventory
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update for inventory" ON inventory
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete for inventory" ON inventory
    FOR DELETE
    USING (true);

-- ============================================
-- GIRLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS girls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    physical_description TEXT,
    relation VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for girls
CREATE INDEX IF NOT EXISTS idx_girls_name ON girls(name);
CREATE INDEX IF NOT EXISTS idx_girls_created_at ON girls(created_at DESC);

-- ============================================
-- GIRL_MATERIAL TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS girl_material (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    girl_id UUID NOT NULL REFERENCES girls(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    media_url TEXT NOT NULL,  -- URL to image or video in storage
    media_type VARCHAR(50) NOT NULL,  -- 'image' or 'video'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for girl_material
CREATE INDEX IF NOT EXISTS idx_girl_material_girl_id ON girl_material(girl_id);
CREATE INDEX IF NOT EXISTS idx_girl_material_created_at ON girl_material(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_girl_material_media_type ON girl_material(media_type);

-- ============================================
-- CHAT_HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role VARCHAR(50) NOT NULL,  -- 'user' or 'assistant'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for chat_history
CREATE INDEX IF NOT EXISTS idx_chat_history_role ON chat_history(role);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE TRIGGER update_girls_updated_at
    BEFORE UPDATE ON girls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_girl_material_updated_at
    BEFORE UPDATE ON girl_material
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE girls ENABLE ROW LEVEL SECURITY;
ALTER TABLE girl_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- GIRLS POLICIES: Allow public read/write
CREATE POLICY "Allow public read access for girls" ON girls
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert for girls" ON girls
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update for girls" ON girls
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete for girls" ON girls
    FOR DELETE
    USING (true);

-- GIRL_MATERIAL POLICIES: Allow public read/write
CREATE POLICY "Allow public read access for girl_material" ON girl_material
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert for girl_material" ON girl_material
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update for girl_material" ON girl_material
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete for girl_material" ON girl_material
    FOR DELETE
    USING (true);

-- CHAT_HISTORY POLICIES: Allow public read/write
CREATE POLICY "Allow public read access for chat_history" ON chat_history
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert for chat_history" ON chat_history
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update for chat_history" ON chat_history
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete for chat_history" ON chat_history
    FOR DELETE
    USING (true);


-- Storage Bucket Policies for girl-material
-- First create the bucket in Supabase Dashboard: Storage → New bucket → name: "girl-material" → Public: ON

-- Policy to allow anyone to read (view) media
CREATE POLICY "Allow public read access for girl material"
ON storage.objects
FOR SELECT
USING (bucket_id = 'girl-material');

-- Policy to allow anyone to upload media
CREATE POLICY "Allow public upload for girl material"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'girl-material');

-- Policy to allow anyone to delete media
CREATE POLICY "Allow public delete for girl material"
ON storage.objects
FOR DELETE
USING (bucket_id = 'girl-material');

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

-- ============================================
-- PLAYER-STATE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS "player-state" (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    is_in_chastity BOOLEAN DEFAULT false,
    chastity_device VARCHAR(255),
    location VARCHAR(255),
    last_orgasm TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for player-state
CREATE INDEX IF NOT EXISTS idx_player_state_created_at ON "player-state"(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_player_state_updated_at
    BEFORE UPDATE ON "player-state"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on player-state
ALTER TABLE "player-state" ENABLE ROW LEVEL SECURITY;

-- PLAYER-STATE POLICIES: Allow public read/write
CREATE POLICY "Allow public read access for player-state" ON "player-state"
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert for player-state" ON "player-state"
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update for player-state" ON "player-state"
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete for player-state" ON "player-state"
    FOR DELETE
    USING (true);