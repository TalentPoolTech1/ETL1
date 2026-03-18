#!/bin/bash

# Root directory of the project
PROJECT_ROOT=$(pwd)

# Log files in the root directory
BACKEND_LOG="$PROJECT_ROOT/backend.log"
FRONTEND_LOG="$PROJECT_ROOT/frontend.log"

echo "Starting ETL1 services..."

# Step 1: Stop any existing services
# This ensures we don't have multiple instances running or port conflicts
if [ -f "$PROJECT_ROOT/stop.sh" ]; then
    echo "Stopping any existing services first..."
    bash "$PROJECT_ROOT/stop.sh"
else
    echo "Warning: stop.sh not found. Skipping stop step."
fi

# Step 2: Start Backend
echo "Starting Backend..."
cd "$PROJECT_ROOT/Backend" || exit
npm run dev > "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID). Logging to $BACKEND_LOG"

# Step 3: Start Frontend
echo "Starting Frontend..."
cd "$PROJECT_ROOT/Frontend" || exit
npm run dev > "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID). Logging to $FRONTEND_LOG"

echo "All services are starting up in the background."
echo "You can check the logs for progress:"
echo "  tail -f backend.log"
echo "  tail -f frontend.log"
