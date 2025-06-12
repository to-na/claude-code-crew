#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Save current directory
WORK_DIR=$(pwd)

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "pnpm is not installed. Please install it first:"
    echo "npm install -g pnpm"
    exit 1
fi

# Move to script directory for dependency installation
cd "$SCRIPT_DIR"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
fi

# Start the development servers with the work directory
echo "Starting Claude Crew..."
echo "Working directory: $WORK_DIR"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Pass the work directory as environment variable
WORK_DIR="$WORK_DIR" pnpm dev