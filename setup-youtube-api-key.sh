#!/bin/bash

# YouTube Data API v3 Setup Script
# This script helps you configure YouTube API key for production

set -e

echo "============================================================"
echo "  YouTube Data API v3 Setup"
echo "============================================================"
echo ""

# Check if we're already connected to Kubernetes
echo "🔐 Checking Kubernetes connection..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Error: Cannot connect to Kubernetes cluster"
    echo "   Please ensure you're connected to the cluster first"
    exit 1
fi
echo "✓ Connected to Kubernetes cluster"
echo ""

# Check current API key status
echo "🔍 Checking current configuration..."
CURRENT_KEY=$(kubectl get deployment video-transcription -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="YOUTUBE_API_KEY")].value}' 2>/dev/null || echo "")

if [ -n "$CURRENT_KEY" ]; then
    echo "⚠️  YouTube API key is already configured"
    echo "   Current key: ${CURRENT_KEY:0:20}...${CURRENT_KEY: -4}"
    echo ""
    read -p "Do you want to update it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled"
        exit 0
    fi
else
    echo "ℹ️  No YouTube API key configured yet"
fi
echo ""

# Instructions for getting API key
echo "============================================================"
echo "  Step 1: Get YouTube Data API v3 Key"
echo "============================================================"
echo ""
echo "📖 Follow these steps to get your API key:"
echo ""
echo "1. Go to: https://console.cloud.google.com/apis/credentials"
echo ""
echo "2. Select your project (or create a new one)"
echo ""
echo "3. Enable YouTube Data API v3:"
echo "   - Go to: https://console.cloud.google.com/apis/library"
echo "   - Search for 'YouTube Data API v3'"
echo "   - Click 'Enable'"
echo ""
echo "4. Create API Key:"
echo "   - Go back to: https://console.cloud.google.com/apis/credentials"
echo "   - Click '+ CREATE CREDENTIALS' → 'API key'"
echo "   - Copy the generated API key"
echo ""
echo "5. (Recommended) Restrict the API key:"
echo "   - Click 'Edit API key'"
echo "   - Under 'API restrictions', select 'Restrict key'"
echo "   - Select only 'YouTube Data API v3'"
echo "   - Click 'Save'"
echo ""
echo "============================================================"
echo ""

# Prompt for API key
echo "📝 Please enter your YouTube API key:"
read -p "API Key: " API_KEY

if [ -z "$API_KEY" ]; then
    echo "❌ Error: API key cannot be empty"
    exit 1
fi

# Validate API key format (basic check)
if [[ ! $API_KEY =~ ^AIza[0-9A-Za-z_-]{35}$ ]]; then
    echo "⚠️  Warning: API key doesn't match expected format (AIzaXXX...)"
    echo "   Expected format: AIza followed by 35 characters"
    echo "   Your key: $API_KEY"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "============================================================"
echo "  Step 2: Configure Kubernetes"
echo "============================================================"
echo ""

# Update deployment
echo "📦 Updating video-transcription deployment..."
kubectl set env deployment/video-transcription YOUTUBE_API_KEY="$API_KEY"

echo "✓ Environment variable set"
echo ""

# Wait for rollout
echo "⏳ Waiting for deployment to rollout..."
kubectl rollout status deployment/video-transcription --timeout=2m

echo ""
echo "============================================================"
echo "  ✅ Setup Complete!"
echo "============================================================"
echo ""
echo "The video-transcription service is now configured with YouTube Data API v3."
echo ""
echo "📊 Quota Information:"
echo "   - Daily Quota: 10,000 units (free tier)"
echo "   - Per Caption: ~50 units"
echo "   - Videos/Day: ~200 videos with free quota"
echo ""
echo "🧪 Test it with:"
echo "   node test-production.js https://www.youtube.com/watch?v=dQw4w9WgXcQ"
echo ""
echo "📝 View logs:"
echo "   kubectl logs -l app=video-transcription --tail=50"
echo ""
echo "Expected log message:"
echo "   '✓ YouTube Data API v3 enabled - will try captions first'"
echo ""
echo "📈 Monitor quota usage:"
echo "   https://console.cloud.google.com/apis/dashboard"
echo ""
