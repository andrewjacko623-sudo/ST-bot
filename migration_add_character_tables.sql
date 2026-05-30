-- Migration: Add category to inventory + new locations table
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Add category column to inventory
-- ============================================
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'toy';

-- Mark all existing items as 'toy' so they appear in the Toys section
UPDATE inventory SET category = 'toy' WHERE category IS NULL;

-- Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);

-- ============================================
-- 2. Locations table
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON locations(created_at DESC);

-- Auto-update updated_at
CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. RLS for locations
-- ============================================
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for locations" ON locations
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert for locations" ON locations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update for locations" ON locations
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete for locations" ON locations
    FOR DELETE USING (true);
