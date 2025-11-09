# Backend Run Instructions

## The Problem
When running uvicorn from the `backend/` directory, Python cannot find the `backend` module.
You MUST run uvicorn from the project root (`trivAI-main/`).

## Solution 1: Use the Start Script (Recommended)

From the project root:
```bash
cd /Users/mukhammadaliyuldoshev/Downloads/trivAI-main
./start-backend.sh
```

## Solution 2: Manual Run

1. Go to project root (NOT backend directory):
```bash
cd /Users/mukhammadaliyuldoshev/Downloads/trivAI-main
```

2. Activate virtual environment:
```bash
source backend/.venv/bin/activate
```

3. Run uvicorn from project root:
```bash
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 3002
```

## Why This Works
- Running from project root allows Python to find the `backend` module
- The virtual environment has all dependencies installed
- Port 3002 matches frontend configuration

## Test
After starting, test with:
```bash
curl http://127.0.0.1:3002/
# Should return: {"Status":"Site is working good!"}
```
