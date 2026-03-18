#!/bin/bash

# Port numbers for the services
BACKEND_PORT=3001
FRONTEND_PORT=5173

echo "Stopping ETL1 services..."

# Function to stop process on a specific port
stop_port() {
    local port=$1
    local name=$2
    local pids=$(lsof -t -i :$port)
    if [ -n "$pids" ]; then
        for pid in $pids; do
            echo "Stopping $name on port $port (PID: $pid)..."
            kill $pid 2>/dev/null
        done
        # Give it a moment to stop
        sleep 1
        # Force kill if still running
        for pid in $pids; do
            if kill -0 $pid 2>/dev/null; then
                echo "Forcing stop for $pid..."
                kill -9 $pid 2>/dev/null
            fi
        done
    else
        echo "$name is not running on port $port."
    fi
}

# Stop Backend
stop_port $BACKEND_PORT "Backend"

# Stop Frontend
stop_port $FRONTEND_PORT "Frontend"

echo "All services stopped."
