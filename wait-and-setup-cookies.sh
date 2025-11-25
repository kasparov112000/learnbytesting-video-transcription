#!/bin/bash

COOKIES_FILE="youtube-cookies.txt"

echo "============================================================"
echo "  Waiting for YouTube Cookies File"
echo "============================================================"
echo ""
echo "📋 Please follow these steps:"
echo ""
echo "1. Open Chrome and install the extension:"
echo "   https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
echo ""
echo "2. Go to https://www.youtube.com (make sure you're logged in)"
echo ""
echo "3. Click the cookie extension icon → 'Export'"
echo ""
echo "4. Save/move the file to:"
echo "   $(pwd)/$COOKIES_FILE"
echo ""
echo "5. This script will automatically detect it and set up Kubernetes!"
echo ""
echo "============================================================"
echo ""
echo "⏳ Watching for file: $COOKIES_FILE"
echo ""

# Wait for file to appear
while [ ! -f "$COOKIES_FILE" ]; do
    sleep 2
done

echo ""
echo "✅ File detected! Starting setup..."
echo ""

# Run the setup script
chmod +x setup-youtube-cookies.sh
./setup-youtube-cookies.sh

echo ""
echo "🎉 All done! Testing now..."
echo ""

# Test the endpoint
node test-production.js https://www.youtube.com/shorts/92SmJPHa8xI
