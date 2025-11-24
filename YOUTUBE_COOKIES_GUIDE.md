# How to Fix YouTube "Sign in to confirm you're not a bot" Error

## The Problem

When transcribing YouTube videos, you may encounter this error:

```
ERROR: [youtube] VIDEO_ID: Sign in to confirm you're not a bot.
This helps protect our community.
```

This happens because YouTube's anti-bot detection blocks automated download tools like yt-dlp. The solution is to use cookies from a logged-in YouTube session.

## The Solutions

There are **two methods** to provide YouTube cookies. Choose the one that works best for you:

### **Method 1: Browser Cookie Extraction** (✅ Recommended - Easier!)
Let yt-dlp automatically extract cookies from your browser - no file exports needed!

### **Method 2: Cookie File Export** (Alternative)
Manually export cookies to a file using a browser extension.

---

## Method 1: Browser Cookie Extraction (Recommended)

This is the **easiest method** - just set an environment variable and you're done!

### Prerequisites
- You must be **logged in to YouTube** in the browser you specify
- The browser must be installed on the same machine where the service runs

### Configuration

1. **Login to YouTube** in your browser (Chrome, Firefox, Edge, etc.)

2. **Set the environment variable** in your `.env` file:
   ```env
   YOUTUBE_COOKIES_BROWSER=chrome
   ```

   Supported browsers:
   - `chrome` - Google Chrome
   - `firefox` - Mozilla Firefox
   - `edge` - Microsoft Edge
   - `safari` - Safari (macOS)
   - `brave` - Brave Browser
   - `opera` - Opera
   - `vivaldi` - Vivaldi

3. **Restart the service** to apply changes

### How It Works

The service will automatically extract cookies from your browser's cookie storage every time it downloads a video. No manual exports needed!

### Limitations

- Works best for **local development** and **single-machine deployments**
- For containerized/production environments, use Method 2 (cookie file)
- Browser must be installed on the server

---

## Method 2: Cookie File Export (Alternative)

Use this method if:
- You're deploying to a container/server without a browser
- Method 1 doesn't work for your environment
- You prefer manual control over cookies

## Step-by-Step Guide

### Step 1: Install a Browser Extension

You need a browser extension to export cookies in Netscape format (the format yt-dlp accepts).

#### **Chrome/Edge** - Recommended: "Get cookies.txt LOCALLY"

1. Go to: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc
2. Click "Add to Chrome" or "Add to Edge"
3. Pin the extension to your toolbar for easy access

#### **Firefox** - "cookies.txt"

1. Go to: https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/
2. Click "Add to Firefox"

#### **Alternative Tools**

- [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie) (Chrome)
- Manual export using browser DevTools (advanced users)

---

### Step 2: Login to YouTube

1. Open your browser and go to https://www.youtube.com
2. **Sign in to your Google/YouTube account**
3. Make sure you're fully logged in (check that your profile picture appears in the top-right)

**Important:** The cookies must be from a logged-in session. Without login, the cookies won't help bypass bot detection.

---

### Step 3: Export the Cookies

#### Using "Get cookies.txt LOCALLY" (Chrome/Edge)

1. **Stay on youtube.com** (the extension exports cookies for the current domain)
2. Click the extension icon in your toolbar
3. Click **"Export"**
4. Your browser will download a file named `youtube.com_cookies.txt`
5. **Rename it to `cookies.txt`**

#### Using "cookies.txt" (Firefox)

1. **Stay on youtube.com**
2. Click the extension icon
3. Click **"Current Site"**
4. Save the file as `cookies.txt`

---

### Step 4: Place the Cookies File

Move the `cookies.txt` file to your video-transcription project root:

```
video-transcription/
├── app/
├── config/
├── cookies.txt  ← Place it here
├── .env
└── package.json
```

**Security Note:** The `cookies.txt` file contains sensitive authentication data. Make sure it's:
- ✅ Listed in `.gitignore` (it should be by default)
- ✅ Not shared publicly or committed to version control
- ✅ Kept secure on your development machine

---

### Step 5: Configure Environment Variables

Edit your `.env` file:

```bash
# YouTube Configuration
YOUTUBE_COOKIES_FILE=./cookies.txt
YOUTUBE_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
```

**If cookies file is in a different location:**
```bash
YOUTUBE_COOKIES_FILE=/path/to/your/cookies.txt
```

---

### Step 6: Restart the Service

```bash
npm run start
# or
npm run start:dev
```

You should see this message in the logs when starting:
```
Using YouTube cookies from: ./cookies.txt
```

---

## Testing the Fix

Try transcribing a video that previously failed:

```bash
curl -X POST http://localhost:3016/transcription/transcribe \
  -H "Content-Type: application/json" \
  -d '{
    "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
    "language": "en-US"
  }'
```

If successful, you should get:
```json
{
  "transcriptionId": "...",
  "status": "processing",
  "message": "Transcription started successfully"
}
```

---

## Troubleshooting

### Error: "Cookies file not found"

**Problem:** The service can't find your cookies file.

**Solution:**
1. Check the file path in `.env` is correct
2. Make sure `cookies.txt` exists at that location
3. Use absolute path if relative path doesn't work:
   ```bash
   YOUTUBE_COOKIES_FILE=C:/Users/YourName/repos/lbt/video-transcription/cookies.txt
   ```

### Still Getting Bot Detection Error

**Problem:** Even with cookies, YouTube still blocks the request.

**Solutions:**

1. **Refresh your cookies:**
   - Cookies expire or become invalid
   - Re-export fresh cookies from a logged-in session
   - YouTube may have detected unusual activity on your account

2. **Update yt-dlp:**
   ```bash
   npm update youtube-dl-exec
   ```

3. **Try a different Google account:**
   - Some accounts get flagged more than others
   - Use a personal account rather than organizational

4. **Check if the video is restricted:**
   - Age-restricted videos may require additional verification
   - Region-locked content may not be accessible
   - Private or unlisted videos need proper permissions

### Cookies Expire Quickly

**Problem:** Cookies stop working after a few days/weeks.

**Solution:**
- YouTube cookies typically last 1-6 months
- When they expire, simply export fresh cookies again
- Consider setting up a reminder to refresh cookies monthly

---

## Security Best Practices

### ⚠️ Important Security Notes

1. **Never commit cookies to git:**
   ```bash
   # Already in .gitignore
   cookies.txt
   *.txt
   ```

2. **Rotate cookies regularly:**
   - Treat cookies like passwords
   - Re-export monthly or when they expire

3. **Use a dedicated account (optional):**
   - For production/team environments
   - Create a Google account specifically for video transcription
   - Reduces risk to your personal account

4. **Don't share cookies:**
   - Cookies grant access to your YouTube account
   - Anyone with your cookies can act as you on YouTube

---

## Production Deployment

### Using Kubernetes Secrets

For production deployments, store cookies as a Kubernetes secret:

```bash
# Create secret from cookies file
kubectl create secret generic youtube-cookies \
  --from-file=cookies.txt=./cookies.txt

# Update deployment to mount the secret
kubectl set volume deployment/video-transcription \
  --add --name=cookies \
  --secret-name=youtube-cookies \
  --mount-path=/app/cookies
```

Update `.env` or Helm values:
```yaml
env:
  - name: YOUTUBE_COOKIES_FILE
    value: "/app/cookies/cookies.txt"
```

### Using Docker

```dockerfile
# In Dockerfile
COPY cookies.txt /app/cookies.txt
ENV YOUTUBE_COOKIES_FILE=/app/cookies.txt
```

Or mount at runtime:
```bash
docker run -v $(pwd)/cookies.txt:/app/cookies.txt \
  -e YOUTUBE_COOKIES_FILE=/app/cookies.txt \
  your-image
```

---

## Alternative Solutions (If Cookies Don't Work)

If cookies still don't solve the issue:

1. **Use YouTube Data API v3:**
   - Official API with proper authentication
   - Limited to metadata, not full video download
   - Requires API key from Google Cloud Console

2. **Self-host yt-dlp with residential proxy:**
   - More complex setup
   - Residential IPs are less likely to be flagged

3. **Contact the video uploader:**
   - Request permission to transcribe
   - They might provide direct video file

---

## Additional Resources

- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp#readme)
- [yt-dlp Cookies Guide](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp)
- [YouTube Terms of Service](https://www.youtube.com/t/terms)

---

## Questions?

If you continue to experience issues:

1. Check the service logs for specific error messages
2. Verify cookies file format (Netscape HTTP Cookie File)
3. Ensure you're logged into YouTube when exporting cookies
4. Try with a different video to rule out video-specific restrictions
