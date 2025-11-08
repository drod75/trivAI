#!/bin/bash

# Script to start the backend server with virtual environment

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating it..."
    python3 -m venv venv
    echo "Installing dependencies..."
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
else
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Please create one with GOOGLE_API_KEY"
    echo "Quiz generation will fail without an API key."
fi

# Go to project root to run uvicorn
cd ..

# Start the server
echo "Starting backend server on http://localhost:8000"
python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

