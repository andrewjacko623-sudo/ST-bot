# Supabase Setup Guide

This guide will help you set up Supabase for the Tasks and Inventory features.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Create a new project
3. Wait for the project to be set up (takes a few minutes)

## Step 2: Set Up Database Tables

1. Go to the **SQL Editor** in your Supabase dashboard
2. Copy and paste the contents of `supabase_schema.sql`
3. Run the SQL script to create the tables and policies

This will create:
- `tasks` table (for Task List page)
- `inventory` table (for Inventory page)
- All necessary indexes and triggers
- Row Level Security policies (currently set to public access)

## Step 3: Set Up Storage Bucket for Images

1. Go to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. Name it: `inventory-images`
4. Make it **Public** (so images are accessible via URL)
5. Click **Create bucket**

### Storage Policies (Optional - already handled by public bucket)

If you want to customize access, go to **Storage** → **Policies** → `inventory-images` and set up policies.

## Step 4: Get Your Supabase Credentials

1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys" → "anon public")

## Step 5: Configure Frontend

1. In the `frontend` directory, create a `.env` file (copy from `.env.example` if it exists)
2. Add your Supabase credentials:

```env
REACT_APP_SUPABASE_URL=your_project_url_here
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
REACT_APP_API_URL=http://localhost:8000
```

Replace `your_project_url_here` and `your_anon_key_here` with your actual Supabase credentials.

## Step 6: Install Dependencies and Run

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the frontend:
```bash
npm start
```

## How It Works

### Tasks Page
- **Add Task**: Creates a new entry in the `tasks` table
- **Delete Task**: Removes the entry from the `tasks` table
- **Load Tasks**: Fetches all tasks from Supabase on page load

### Inventory Page
- **Add Item**: 
  - Uploads image to Supabase Storage (`inventory-images` bucket)
  - Creates entry in `inventory` table with the image URL
- **Delete Item**: 
  - Removes entry from `inventory` table
  - Deletes the image from Storage
- **Load Items**: Fetches all items from Supabase on page load

## Troubleshooting

### "Supabase credentials are missing" warning
- Make sure you created the `.env` file in the `frontend` directory
- Restart the React dev server after creating/updating `.env`
- Check that variable names start with `REACT_APP_`

### "Failed to load tasks/inventory"
- Check your Supabase URL and API key are correct
- Make sure you ran the SQL schema script
- Check browser console for detailed error messages

### Image upload fails
- Make sure the `inventory-images` bucket exists in Storage
- Verify the bucket is set to **Public**
- Check file size (max 5MB currently enforced)

### Row Level Security (RLS) errors
- The schema includes public access policies
- If you get permission errors, check the policies in Supabase dashboard
- Go to **Authentication** → **Policies** to review/modify policies
