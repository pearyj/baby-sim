#!/bin/bash

# Vercel deployment script
echo "🚀 Starting Vercel deployment process..."

# Check if required environment variables are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "⚠️  Warning: Missing Supabase environment variables"
fi

if [ -z "$STRIPE_SECRET_KEY" ] || [ -z "$STRIPE_PUBLISHABLE_KEY" ]; then
    echo "⚠️  Warning: Missing Stripe environment variables"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the project
echo "🔨 Building project..."
npm run build

echo "✅ Build completed successfully!"
echo "🌐 Ready for deployment to Vercel"