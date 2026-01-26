# Hosting Guide

This guide covers how to host both the FastAPI backend and React frontend.

## Architecture Overview

- **Backend**: FastAPI (Python) - needs to run continuously
- **Frontend**: React (static build) - can be hosted on CDN/static hosting
- **Database**: Supabase (already cloud-hosted)
- **API**: Grok API (external service)

## Recommended Hosting Options

### Option 1: Railway (Easiest - Recommended) ⭐

**Best for**: Quick deployment, both backend and frontend

#### Backend Setup:
1. Go to [railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub repo
4. Railway will auto-detect Python
5. Set environment variables:
   - `GROK_API_KEY=your_key`
   - `SUPABASE_URL=your_url`
   - `SUPABASE_KEY=your_key`
6. Add a `Procfile` in project root:
   ```
   web: uvicorn chatbot_api.chatbot:app --host 0.0.0.0 --port $PORT
   ```
7. Railway will auto-deploy and give you a URL like `https://your-app.railway.app`

#### Frontend Setup:
1. In Railway, add another service
2. Select your repo again
3. Set root directory to `frontend`
4. Set build command: `npm install && npm run build`
5. Set start command: `npx serve -s build -l $PORT`
6. Add environment variables:
   - `REACT_APP_API_URL=https://your-backend.railway.app`
   - `REACT_APP_SUPABASE_URL=your_supabase_url`
   - `REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key`

**Cost**: Free tier available, then ~$5-20/month

---

### Option 2: Render (Free Tier Available)

#### Backend Setup:
1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Web Service"
3. Connect your GitHub repo
4. Settings:
   - **Name**: `stbot-backend`
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn chatbot_api.chatbot:app --host 0.0.0.0 --port $PORT`
5. Add environment variables (same as Railway)
6. Deploy

#### Frontend Setup:
1. Click "New" → "Static Site"
2. Connect your GitHub repo
3. Settings:
   - **Name**: `stbot-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
4. Add environment variables (same as Railway)
5. Deploy

**Cost**: Free tier (spins down after inactivity), $7/month for always-on

---

### Option 3: Vercel (Frontend) + Railway/Render (Backend)

**Best for**: Best performance for frontend

#### Frontend on Vercel:
1. Go to [vercel.com](https://vercel.com) and sign up
2. Import your GitHub repo
3. Settings:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
4. Add environment variables:
   - `REACT_APP_API_URL=https://your-backend-url.com`
   - `REACT_APP_SUPABASE_URL=your_supabase_url`
   - `REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key`
5. Deploy

#### Backend on Railway/Render:
Follow Option 1 or 2 for backend

**Cost**: Vercel free tier is excellent, backend $5-20/month

---

### Option 4: Fly.io (Good for Backend)

#### Backend Setup:
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. In project root, create `fly.toml`:
   ```toml
   app = "stbot-backend"
   primary_region = "iad"

   [build]

   [http_service]
     internal_port = 8000
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 0

   [[vm]]
     cpu_kind = "shared"
     cpus = 1
     memory_mb = 256
   ```
4. Run: `fly launch`
5. Set secrets: `fly secrets set GROK_API_KEY=xxx SUPABASE_URL=xxx SUPABASE_KEY=xxx`
6. Deploy: `fly deploy`

**Cost**: Free tier available, then pay-as-you-go

---

## Required Files for Hosting

### 1. Create `Procfile` (for Railway/Heroku):
```
web: uvicorn chatbot_api.chatbot:app --host 0.0.0.0 --port $PORT
```

### 2. Create `runtime.txt` (optional, for Python version):
```
python-3.12.0
```

### 3. Update CORS in `chatbot.py`:
Make sure CORS allows your frontend domain:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local dev
        "https://your-frontend.vercel.app",  # Production
        # Add all your frontend URLs
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Or for development, you can use:
```python
allow_origins=["*"]  # Only for testing - restrict in production!
```

### 4. Update Frontend API URL:
In production, your frontend `.env` or build-time variables should point to your deployed backend URL, not `localhost:8000`.

---

## Environment Variables Summary

### Backend (.env or hosting platform):
```
GROK_API_KEY=your_grok_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_service_role_key
```

### Frontend (build-time variables):
```
REACT_APP_API_URL=https://your-backend-url.com
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important**: React environment variables must start with `REACT_APP_` and are baked into the build at build time. You'll need to rebuild if you change them.

---

## Step-by-Step: Railway (Recommended)

### Backend:
1. **Prepare repository**:
   - Make sure `requirements.txt` exists
   - Create `Procfile` with: `web: uvicorn chatbot_api.chatbot:app --host 0.0.0.0 --port $PORT`

2. **Deploy on Railway**:
   - Sign up at railway.app
   - New Project → Deploy from GitHub
   - Select your repo
   - Railway auto-detects Python
   - Add environment variables in Settings → Variables
   - Railway gives you a URL like `https://stbot-backend.railway.app`

3. **Update CORS** in `chatbot.py` to allow your frontend domain

### Frontend:
1. **Build locally first** (to test):
   ```bash
   cd frontend
   npm install
   REACT_APP_API_URL=https://your-backend.railway.app \
   REACT_APP_SUPABASE_URL=your_url \
   REACT_APP_SUPABASE_ANON_KEY=your_key \
   npm run build
   ```

2. **Deploy on Railway**:
   - Add new service in same project
   - Select repo again
   - Set root directory: `frontend`
   - Build command: `npm install && npm run build`
   - Start command: `npx serve -s build -l $PORT`
   - Add environment variables
   - Deploy

3. **Or deploy on Vercel** (better for React):
   - Import repo to Vercel
   - Root directory: `frontend`
   - Framework: Create React App
   - Add environment variables
   - Deploy

---

## Testing Your Deployment

1. **Backend Health Check**:
   - Visit: `https://your-backend.railway.app/health`
   - Should return: `{"status":"healthy"}`

2. **Frontend**:
   - Visit your frontend URL
   - Check browser console for errors
   - Test chat functionality

3. **CORS Issues**:
   - If you see CORS errors, update `allow_origins` in `chatbot.py` to include your frontend URL

---

## Troubleshooting

### Backend won't start:
- Check logs in hosting platform
- Verify environment variables are set
- Make sure `Procfile` or start command is correct
- Check Python version compatibility

### Frontend can't connect to backend:
- Verify `REACT_APP_API_URL` is correct (no trailing slash)
- Check CORS settings in backend
- Verify backend is running and accessible

### Environment variables not working:
- **Backend**: Check hosting platform's environment variable settings
- **Frontend**: React variables must start with `REACT_APP_` and require a rebuild

### Database connection issues:
- Verify Supabase URL and keys are correct
- Check Supabase project is active
- Verify RLS policies allow public access (if needed)

---

## Cost Comparison

| Platform | Backend | Frontend | Free Tier | Paid Start |
|----------|---------|----------|-----------|------------|
| Railway | ✅ | ✅ | Limited | $5/month |
| Render | ✅ | ✅ | Yes (sleeps) | $7/month |
| Vercel | ❌ | ✅ | Excellent | Free |
| Fly.io | ✅ | ❌ | Yes | Pay-as-you-go |

**Recommended**: Railway for both (easiest) or Vercel (frontend) + Railway (backend)

---

## Next Steps

1. Choose a hosting platform
2. Create `Procfile` in project root
3. Update CORS settings in `chatbot.py`
4. Deploy backend first, get URL
5. Update frontend environment variables with backend URL
6. Deploy frontend
7. Test everything works
8. Update CORS to only allow your production frontend URL

Good luck! 🚀
