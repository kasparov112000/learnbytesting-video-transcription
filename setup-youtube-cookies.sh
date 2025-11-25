#!/bin/bash

# YouTube Cookies Setup Script for Production
# This script helps you create a Kubernetes secret with YouTube cookies

set -e

COOKIES_FILE="youtube-cookies.txt"
SECRET_NAME="youtube-cookies"

echo "============================================================"
echo "  YouTube Cookies Setup for Production"
echo "============================================================"
echo ""

# Check if cookies file exists
if [ ! -f "$COOKIES_FILE" ]; then
    echo "❌ Error: $COOKIES_FILE not found"
    echo ""
    echo "📖 Please follow these steps:"
    echo ""
    echo "1. Install browser extension:"
    echo "   Chrome/Edge: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
    echo "   Firefox: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/"
    echo ""
    echo "2. Login to YouTube in your browser"
    echo ""
    echo "3. Go to https://www.youtube.com and click the extension icon"
    echo ""
    echo "4. Export cookies and save as: $COOKIES_FILE"
    echo ""
    echo "5. Place the file in the video-transcription directory"
    echo ""
    echo "6. Run this script again"
    echo ""
    exit 1
fi

echo "✓ Found cookies file: $COOKIES_FILE"
echo ""

# Validate cookies file format
if ! grep -q "youtube.com" "$COOKIES_FILE"; then
    echo "⚠️  Warning: Cookies file doesn't contain youtube.com entries"
    echo "   Make sure you exported cookies from youtube.com"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "🔐 Checking Kubernetes connection..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Error: Cannot connect to Kubernetes cluster"
    echo "   Make sure you're connected to the correct cluster"
    exit 1
fi
echo "✓ Connected to Kubernetes cluster"
echo ""

# Check if secret already exists
if kubectl get secret "$SECRET_NAME" &> /dev/null; then
    echo "⚠️  Secret '$SECRET_NAME' already exists"
    read -p "Do you want to replace it? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Deleting existing secret..."
        kubectl delete secret "$SECRET_NAME"
        echo "✓ Deleted"
        echo ""
    else
        echo "❌ Cancelled"
        exit 0
    fi
fi

# Create the secret
echo "📦 Creating Kubernetes secret..."
kubectl create secret generic "$SECRET_NAME" \
  --from-file=cookies.txt="$COOKIES_FILE"

echo "✓ Secret created successfully"
echo ""

# Verify the secret
echo "🔍 Verifying secret..."
kubectl get secret "$SECRET_NAME" -o yaml | grep -q "cookies.txt"
echo "✓ Secret verified"
echo ""

# Restart deployment
echo "🔄 Restarting deployment to pick up new cookies..."
kubectl rollout restart deployment/video-transcription

echo "✓ Deployment restarted"
echo ""

# Wait for deployment to be ready
echo "⏳ Waiting for deployment to be ready..."
kubectl rollout status deployment/video-transcription --timeout=2m

echo ""
echo "============================================================"
echo "  ✅ Setup Complete!"
echo "============================================================"
echo ""
echo "The video-transcription service is now configured with YouTube cookies."
echo ""
echo "🧪 Test it with:"
echo "   node test-production.js https://www.youtube.com/shorts/92SmJPHa8xI"
echo ""
echo "📝 View logs:"
echo "   kubectl logs -l app=video-transcription --tail=50"
echo ""
echo "You should see: 'Using YouTube cookies from file: /etc/youtube/cookies.txt'"
echo ""
