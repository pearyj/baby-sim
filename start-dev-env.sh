#!/bin/zsh

# Load environment variables from .env.local
if [ -f .env.local ]; then
    echo "Loading .env.local..."
    set -a  # automatically export all variables
    source .env.local
    set +a  # turn off automatic export
    echo "Environment variables loaded successfully"
else
    echo "Warning: .env.local not found"
fi

# Start vercel dev
echo "Starting vercel dev..."
vercel dev --listen 3001 --yes 