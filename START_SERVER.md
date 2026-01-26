# How to Start the Backend Server

The error `ERR_CONNECTION_REFUSED` means the backend server isn't running. Here's how to start it:

## Option 1: Using Python Module (Recommended)

Open a terminal in the **project root** (not inside chatbot_api folder) and run:

```bash
python -m chatbot_api.chatbot
```

Or if you're using Python 3 specifically:

```bash
python3 -m chatbot_api.chatbot
```

## Option 2: Using Uvicorn Directly

**IMPORTANT**: You must run from the **project root** (e.g. `C:\Users\tempadmin\Desktop\stBot`), **not** from inside `chatbot_api`. Use the **full module path** `chatbot_api.chatbot:app` — **do not** use `chatbot:app`.

```bash
uvicorn chatbot_api.chatbot:app --reload --host 0.0.0.0 --port 8000
```

Or on Windows PowerShell:
```powershell
uvicorn chatbot_api.chatbot:app --reload
```

**Common Error**: `ModuleNotFoundError: No module named 'chatbot_api'` means either (1) you ran `uvicorn chatbot:app` instead of `uvicorn chatbot_api.chatbot:app`, or (2) you're in the `chatbot_api` folder. Use `chatbot_api.chatbot:app` and run from the project root (where the `chatbot_api` folder lives).

The `--reload` flag enables auto-reload when you change code.

## What You Should See

When the server starts successfully, you should see output like:

```
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

## Verify It's Working

1. Open your browser and go to: `http://localhost:8000/health`
2. You should see: `{"status":"healthy"}`

## Common Issues

### Port 8000 Already in Use

If you get an error about port 8000 being in use:
- Find and close the process using port 8000
- Or change the port in the code/command

### Missing Dependencies

If you get import errors, install dependencies:
```bash
pip install -r requirements.txt
```

### Missing Environment Variables

Make sure your `.env` file has:
```
GROK_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_KEY=your_key
```

## Keep Server Running

- Keep the terminal window open while using the app
- The server must be running for the frontend to work
- Press `Ctrl+C` to stop the server
