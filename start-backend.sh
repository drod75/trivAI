#!/bin/bash

# Script to start the backend server from project root
# This ensures Python can find the 'backend' module

# Get the directory where the script is located (project root)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if backend virtual environment exists
if [ -d "backend/.venv" ]; then
    echo "Activating backend virtual environment..."
    source backend/.venv/bin/activate
elif [ -d "backend/venv" ]; then
    echo "Activating backend virtual environment..."
    source backend/venv/bin/activate
else
    echo "Virtual environment not found in backend/.venv or backend/venv"
    echo "Please create a virtual environment first:"
    echo "  cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠ Warning: backend/.env file not found. Please create one with GOOGLE_API_KEY"
    echo "Quiz generation will fail without an API key."
fi

# Start the server from project root (so Python can find 'backend' module)
echo "Starting backend server on http://127.0.0.1:3002"
echo "Running from: $(pwd)"
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 3002

