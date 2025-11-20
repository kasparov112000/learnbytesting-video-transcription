# Google Cloud Speech-to-Text API Setup

This guide explains how to set up Google Cloud Speech-to-Text API for the video transcription microservice.

## Important: OAuth vs Service Account Credentials

The LBT project uses **two different types of Google Cloud credentials**:

### 1. **OAuth Credentials** (Already configured)
- **Purpose**: User authentication ("Sign in with Google")
- **Used by**: `orchnest` service for user login
- **Location**: `orchnest/.env`
- **Type**: Client ID and Client Secret
- **User interaction**: Yes - users click "Sign in with Google"

### 2. **Service Account Credentials** (What we need now)
- **Purpose**: Server-to-server API access (Speech-to-Text)
- **Used by**: `video-transcription` service
- **Location**: `video-transcription/google-credentials.json`
- **Type**: JSON key file
- **User interaction**: No - runs in background

**Key Point**: Both can exist in the same Google Cloud project! You don't need to create a new project.

---

## Setup Steps

### Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. **Select the same project** you're using for OAuth (likely called "LearnByTesting" or similar)

### Step 2: Enable Speech-to-Text API

1. In the left sidebar, click **APIs & Services** → **Library**
2. In the search box, type **"Speech-to-Text API"** or **"Cloud Speech-to-Text API"**
3. Click on the API in the results
4. Click the **ENABLE** button
5. Wait for the API to be enabled

### Step 3: Create a Service Account

A service account is like a "robot user" that can access Google Cloud APIs on behalf of your application.

1. Go to **APIs & Services** → **Credentials** (in the left sidebar)
2. Click **+ CREATE CREDENTIALS** at the top
3. Select **Service Account** from the dropdown
4. Fill in the service account details:
   - **Service account name**: `video-transcription-service`
   - **Service account ID**: (auto-filled, like `video-transcription-service@your-project.iam.gserviceaccount.com`)
   - **Service account description**: `Service account for YouTube video transcription`
5. Click **CREATE AND CONTINUE**

### Step 4: Grant Permissions

1. In the "Grant this service account access to project" section:
   - Click on the **Role** dropdown
   - Search for "Speech"
   - Select **Cloud Speech Service Agent** or **Cloud Speech Administrator**
   - Alternatively, you can use **Project → Editor** for broader access
2. Click **CONTINUE**
3. Click **DONE** (skip the optional "Grant users access to this service account" step)

### Step 5: Create and Download the Key

1. In the **Credentials** page, find the **Service Accounts** section (below "API Keys" and "OAuth 2.0 Client IDs")
2. Click on the service account you just created (`video-transcription-service`)
3. Click on the **KEYS** tab
4. Click **ADD KEY** → **Create new key**
5. Select **JSON** format
6. Click **CREATE**

A JSON file will be downloaded to your computer (e.g., `your-project-abc123-def456.json`)

### Step 6: Install the Credentials

1. Rename the downloaded file to `google-credentials.json`
2. Move it to the `video-transcription` folder:
   ```
   C:\Users\Renato\repos\lbt\video-transcription\google-credentials.json
   ```

3. **IMPORTANT**: Make sure this file is in `.gitignore` (it already is!)

### Step 7: Configure Environment Variables

1. Open `.env` in the `video-transcription` folder
2. Set these variables:
   ```env
   TRANSCRIPTION_PROVIDER=google
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
   ```

3. Find your Project ID:
   - In Google Cloud Console, look at the top navigation bar
   - Your project name is shown with the ID below it
   - Example: `learnbytesting-12345`

### Step 8: Verify the Setup

1. Start the transcription service:
   ```bash
   cd C:\Users\Renato\repos\lbt\video-transcription
   npm run start
   ```

2. You should see:
   ```
   ✓ Google Cloud Speech-to-Text client initialized
   ✓ MongoDB connected successfully
   ✓ Routes registered
   Service is ready to accept requests
   ```

---

## Comparison: OAuth vs Service Account

| Feature | OAuth Credentials | Service Account |
|---------|------------------|-----------------|
| Purpose | User authentication | API access |
| File type | Client ID + Secret in `.env` | JSON key file |
| Requires user consent | Yes | No |
| Used for | Logging users into your app | Calling Google APIs from server |
| Scopes needed | `userinfo.email`, `userinfo.profile` | Speech-to-Text permissions |
| Example use | "Sign in with Google" button | Transcribing YouTube videos |

---

## Troubleshooting

### Error: "Could not load the default credentials"

**Cause**: The service can't find the credentials file.

**Solutions**:
1. Check that `google-credentials.json` exists in the project root
2. Verify `GOOGLE_APPLICATION_CREDENTIALS` in `.env` points to the correct path
3. Make sure the path is relative: `./google-credentials.json`

### Error: "Permission denied"

**Cause**: The service account doesn't have the right permissions.

**Solutions**:
1. Go to Google Cloud Console → IAM & Admin → IAM
2. Find your service account (`video-transcription-service@...`)
3. Click the pencil icon (Edit)
4. Add the role **Cloud Speech Service Agent** or **Cloud Speech Administrator**
5. Save

### Error: "API not enabled"

**Cause**: Speech-to-Text API is not enabled for your project.

**Solution**:
1. Go to Google Cloud Console → APIs & Services → Library
2. Search for "Speech-to-Text API"
3. Click ENABLE

### Error: "Quota exceeded"

**Cause**: You've exceeded the free tier quota.

**Solutions**:
1. Check your usage in Google Cloud Console → APIs & Services → Dashboard
2. Free tier: 60 minutes per month
3. Consider enabling billing for higher quotas

---

## Security Best Practices

✅ **DO:**
- Keep `google-credentials.json` in `.gitignore`
- Use different service accounts for development and production
- Regularly rotate service account keys (every 90 days)
- Use the principle of least privilege (only grant necessary permissions)

❌ **DON'T:**
- Commit credentials to version control
- Share service account keys publicly
- Use the same credentials across multiple environments
- Give service accounts more permissions than needed

---

## Cost Estimate

**Google Cloud Speech-to-Text Pricing**:
- First 60 minutes: **FREE** (per month)
- Standard model: $0.006 per 15 seconds (~$1.44/hour)
- Video model: $0.012 per 15 seconds (~$2.88/hour)
- Enhanced model: $0.009 per 15 seconds (~$2.16/hour)

**Example**: Transcribing a 1-hour chess game video:
- Cost: ~$2.88 (using video model)
- Words: ~8,000-10,000
- Processing time: ~10-15 minutes

---

## Alternative: OpenAI Whisper

If you prefer to use OpenAI Whisper instead:

1. Set `.env`:
   ```env
   TRANSCRIPTION_PROVIDER=openai
   OPENAI_API_KEY=sk-your-openai-api-key
   ```

2. Pricing: $0.006 per minute (~$0.36/hour)
3. Pros: More accurate, supports 98 languages
4. Cons: 25MB file limit

---

## Summary

1. ✅ Enable Speech-to-Text API in your existing Google Cloud project
2. ✅ Create a service account with Speech permissions
3. ✅ Download JSON key file
4. ✅ Save as `google-credentials.json` in `video-transcription/`
5. ✅ Configure `.env` with project ID and credentials path
6. ✅ Test the service

You're now ready to transcribe YouTube videos! 🎉

---

## Next Steps

1. Test the API with a sample YouTube URL (see README.md)
2. Integrate with the orchestrator service
3. Add the transcription button to the UI
4. Monitor usage in Google Cloud Console

For more help, see the main [README.md](./README.md) or check the [Google Cloud Speech-to-Text documentation](https://cloud.google.com/speech-to-text/docs).
