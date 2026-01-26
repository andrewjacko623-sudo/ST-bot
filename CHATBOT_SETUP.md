# Chatbot Setup Guide

This guide will help you set up the enhanced chatbot with function calling, chat history, and personality system.

## Backend Setup

### 1. Install Dependencies

Make sure you have the Supabase Python client installed:

```bash
pip install -r requirements.txt
```

This will install `supabase==2.3.0` along with other dependencies.

### 2. Environment Variables

Add these to your `.env` file in the project root:

```env
GROK_API_KEY=your_grok_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key_or_anon_key
```

**Important**: 
- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_KEY`: Use the `anon` key for public access, or `service_role` key for admin access (service_role bypasses RLS)

### 3. Database Setup

Make sure you've run the SQL schema that includes the `chat_history` table. If not, run this in Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_history_role ON chat_history(role);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at DESC);

ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for chat_history" ON chat_history
    FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert for chat_history" ON chat_history
    FOR INSERT
    WITH CHECK (true);
```

### 4. Start the Backend

```bash
python -m chatbot_api.chatbot
```

Or with uvicorn:
```bash
uvicorn chatbot_api.chatbot:app --reload
```

## Frontend Setup

The frontend is already updated to handle media URLs. Just make sure:

1. Your `.env` file in `frontend/` has:
```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

2. Restart the React app if it's running:
```bash
cd frontend
npm start
```

## How It Works

### Function Calling

The chatbot can now call these tools:

1. **`get_task(category)`** - Gets a task from database (only when explicitly requested)
2. **`get_girl()`** - Gets a random girl with her materials (photos/videos)
3. **`get_inventory_items()`** - Gets active inventory items

### Chat History

- All messages are saved to `chat_history` table
- Last 50 messages are loaded and included in the conversation context
- This allows the bot to remember previous conversations

### Personality System

The bot follows strict behavior rules:
- **NEVER** gives tasks unless explicitly requested (keywords: "task", "order", "assign", etc.)
- Mood varies naturally (mild, degrading, teasing)
- Can spontaneously show girl pics/videos with dirty commentary
- Uses tools to fetch real data from database

### Media Display

When the bot calls `get_girl()` and materials are returned:
- Media URLs are extracted and sent in the response
- Frontend automatically displays images/videos in the chat
- Media appears below the bot's message

## Testing

1. Start the backend server
2. Start the frontend
3. Go to the Chat page
4. Try these:
   - "Give me a task" - Should fetch a task from database
   - "Show me a girl" - Should fetch a girl and display her materials
   - "What items do I have?" - Should list active inventory items
   - Regular conversation - Bot will respond with personality, may spontaneously show content

## Troubleshooting

### "Database not configured" errors
- Check your `.env` file has `SUPABASE_URL` and `SUPABASE_KEY`
- Restart the backend after adding env variables

### Function calls not working
- Check that tables exist in Supabase (tasks, girls, girl_material, inventory, chat_history)
- Verify RLS policies allow public access
- Check backend logs for errors

### Media not displaying
- Check browser console for errors
- Verify media URLs are valid Supabase Storage URLs
- Make sure storage buckets are public
