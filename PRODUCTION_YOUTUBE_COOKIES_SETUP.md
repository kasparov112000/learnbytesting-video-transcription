# YouTube Cookies Setup for Production (Kubernetes)

## Problem
YouTube Shorts and some restricted videos require authentication cookies in production. The `YOUTUBE_COOKIES_BROWSER` method doesn't work in containerized environments since browsers aren't installed.

## Solution: Use Cookie File with Kubernetes Secret

### Step 1: Export YouTube Cookies Locally

1. **Install browser extension** (on your local machine):
   - Chrome/Edge: [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. **Login to YouTube** in your browser

3. **Export cookies**:
   - Go to https://www.youtube.com
   - Click the extension icon
   - Click "Export" or "Export as cookies.txt"
   - Save as `youtube-cookies.txt`

### Step 2: Create Kubernetes Secret

```bash
# Navigate to video-transcription directory
cd video-transcription

# Create Kubernetes secret from the cookies file
kubectl create secret generic youtube-cookies \
  --from-file=cookies.txt=./youtube-cookies.txt \
  --dry-run=client -o yaml > youtube-cookies-secret.yaml

# Apply the secret
kubectl apply -f youtube-cookies-secret.yaml

# Verify the secret was created
kubectl get secret youtube-cookies
```

### Step 3: Update Helm Deployment

The deployment has already been configured to:
- Mount the `youtube-cookies` secret as a volume at `/etc/youtube/cookies.txt`
- Set `YOUTUBE_COOKIES_FILE=/etc/youtube/cookies.txt` environment variable

### Step 4: Deploy and Test

```bash
# Deploy the updated configuration
helm upgrade video-transcription ./helm \
  --set image.tag=latest

# Restart the deployment to pick up the new secret
kubectl rollout restart deployment/video-transcription

# Wait for the pod to be ready
kubectl get pods -l app=video-transcription -w

# Test with a YouTube Shorts video
node test-production.js https://www.youtube.com/shorts/92SmJPHa8xI
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Don't commit cookies file to git** - It contains your authentication credentials
2. **Rotate cookies periodically** - YouTube cookies expire after some time
3. **Use a dedicated account** - Consider using a separate YouTube account for the service
4. **Restrict secret access** - Limit which services/users can access the Kubernetes secret

## Troubleshooting

### Error: "Sign in to confirm you're not a bot" still appears

**Possible causes:**
- Cookies have expired (re-export from browser)
- Secret wasn't created or mounted correctly
- Environment variable not set

**Debug steps:**
```bash
# Check if secret exists
kubectl get secret youtube-cookies

# Check if volume is mounted in pod
kubectl get pod -l app=video-transcription -o yaml | grep -A 5 volumes

# Check environment variables in pod
kubectl exec -it deployment/video-transcription -- env | grep YOUTUBE

# View pod logs for cookie loading messages
kubectl logs -l app=video-transcription | grep -i cookie
```

### Cookies expire quickly

YouTube cookies typically last 1-2 weeks. If you see frequent expiration:
- Set up a reminder to refresh cookies weekly
- Consider automating cookie refresh using a browser automation tool
- Monitor logs for "Sign in to confirm" errors

## Manual Secret Creation (Alternative)

If you prefer not to use the YAML file:

```bash
# Create secret directly from file
kubectl create secret generic youtube-cookies \
  --from-file=cookies.txt=./youtube-cookies.txt

# Or create from literal string (if you have the content)
kubectl create secret generic youtube-cookies \
  --from-literal=cookies.txt="$(cat youtube-cookies.txt)"
```

## Updating Cookies

When cookies expire, simply update the secret:

```bash
# Delete old secret
kubectl delete secret youtube-cookies

# Create new secret with updated cookies
kubectl create secret generic youtube-cookies \
  --from-file=cookies.txt=./youtube-cookies.txt

# Restart deployment
kubectl rollout restart deployment/video-transcription
```

## Verification

After setup, you should see in the logs:
```
Using YouTube cookies from file: /etc/youtube/cookies.txt
```

Instead of:
```
No YouTube cookies configured - may encounter bot detection errors
```
