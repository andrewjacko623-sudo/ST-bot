-- Migration: Create kinks table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS kinks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Auto-update updated_at
CREATE TRIGGER update_kinks_updated_at
    BEFORE UPDATE ON kinks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Index for filtering active kinks
CREATE INDEX IF NOT EXISTS idx_kinks_is_active ON kinks(is_active);

-- Enable RLS
ALTER TABLE kinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for kinks"   ON kinks FOR SELECT USING (true);
CREATE POLICY "Allow public insert for kinks" ON kinks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update for kinks" ON kinks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete for kinks" ON kinks FOR DELETE USING (true);
