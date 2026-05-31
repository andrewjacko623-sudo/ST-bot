-- Migration: Add type column to kinks table
-- Run this in your Supabase SQL Editor

ALTER TABLE kinks ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'major';

-- All existing kinks default to 'major' — flip humiliation-style ones to 'minor' in the UI
