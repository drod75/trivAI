# How to Start trivAI

## Prerequisites
1. Backend `.env` file with `GOOGLE_API_KEY`
2. Frontend `.env.local` file with API configuration

## Step 1: Start Backend (Terminal 1)

```bash
cd /Users/mukhammadaliyuldoshev/Downloads/trivAI-main
./start-backend.sh
```

Or manually:
```bash
cd /Users/mukhammadaliyuldoshev/Downloads/trivAI-main
source backend/.venv/bin/activate
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 3002
```

**Expected output:**
```
✓ Loaded .env from: /path/to/backend/.env
INFO:     Uvicorn running on http://127.0.0.1:3002
```

## Step 2: Start Frontend (Terminal 2)

```bash
cd /Users/mukhammadaliyuldoshev/Downloads/trivAI-main/frontend
npm run dev
```

**Expected output:**
```
▲ Next.js 16.0.1
- Local:        http://localhost:3001
```

## Step 3: Test the Application

1. **Open browser:** http://localhost:3001
2. **Test quiz generation:**
   - Enter a topic (e.g., "soccer", "history", "science")
   - Select number of questions (1-30)
   - Choose difficulty (Easy, Medium, Hard)
   - Click "Generate quiz"
3. **Verify TTS:** Each question should be spoken aloud (if ElevenLabs API key is set)
4. **Test error handling:** Stop backend and try generating a quiz (should show error message)

## Testing Backend Directly

```bash
# Health check
curl http://127.0.0.1:3002/

# Generate quiz
curl -X POST http://127.0.0.1:3002/generate-quiz/ \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"soccer","num_questions":3,"difficulty":"Easy"}'
```

## Troubleshooting

### Backend not starting
- Make sure you're in project root (`trivAI-main/`), not `backend/`
- Check that virtual environment is activated
- Verify `backend/.env` has `GOOGLE_API_KEY`

### Frontend can't connect to backend
- Verify backend is running on port 3002
- Check `frontend/.env.local` has `NEXT_PUBLIC_API_URL=http://127.0.0.1:3002`
- Check browser console for CORS errors

### TTS not working
- Verify `frontend/.env.local` has `NEXT_PUBLIC_ELEVENLABS_API_KEY`
- Check browser console for TTS errors
- TTS will log warnings if API key is missing (app will still work)

## Environment Files

### backend/.env
```env
GOOGLE_API_KEY=your_google_api_key_here
```

### frontend/.env.local
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:3002
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
NEXT_PUBLIC_ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

