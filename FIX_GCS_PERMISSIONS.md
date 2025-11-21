# Fix Google Cloud Storage Permissions

## Problem
The service account `video-transcription-service@learnbytesting-ai.iam.gserviceaccount.com` doesn't have permission to create or manage GCS buckets, causing transcription failures for large audio files.

**Error Message:**
```
video-transcription-service@learnbytesting-ai.iam.gserviceaccount.com does not have storage.buckets.create access to the Google Cloud project
```

## Solution: Add Storage Permissions

### Option 1: Using Google Cloud Console (Recommended)

1. **Go to IAM & Admin**
   - Open [Google Cloud Console](https://console.cloud.google.com/)
   - Select project: `learnbytesting-ai`
   - Navigate to: **IAM & Admin** → **IAM**

2. **Find Your Service Account**
   - Look for: `video-transcription-service@learnbytesting-ai.iam.gserviceaccount.com`
   - Click the **pencil icon** (Edit) next to it

3. **Add Storage Admin Role**
   - Click **+ ADD ANOTHER ROLE**
   - Search for: `Storage Admin`
   - Select: **Storage Admin** role
   - Click **SAVE**

### Option 2: Using gcloud CLI

If you have gcloud CLI installed, run these commands:

```bash
# Set the project
gcloud config set project learnbytesting-ai

# Grant Storage Admin role to the service account
gcloud projects add-iam-policy-binding learnbytesting-ai \
  --member="serviceAccount:video-transcription-service@learnbytesting-ai.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

### Option 3: More Granular Permissions (Production Recommended)

If you want to give only specific permissions instead of full Storage Admin:

```bash
# Grant only Storage Object Admin (for bucket management)
gcloud projects add-iam-policy-binding learnbytesting-ai \
  --member="serviceAccount:video-transcription-service@learnbytesting-ai.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Also need bucket creator permission
gcloud projects add-iam-policy-binding learnbytesting-ai \
  --member="serviceAccount:video-transcription-service@learnbytesting-ai.iam.gserviceaccount.com" \
  --role="roles/storage.admin"
```

## Required Permissions

The service account needs these specific permissions:
- ✅ `storage.buckets.create` - Create new buckets
- ✅ `storage.buckets.get` - Check if bucket exists
- ✅ `storage.objects.create` - Upload audio files
- ✅ `storage.objects.delete` - Clean up after transcription
- ✅ `storage.objects.get` - Read audio files for transcription

**Storage Admin** role includes all of these.

## Verify Permissions

After adding the role, wait 1-2 minutes for permissions to propagate, then test:

```bash
# Delete the failed transcript from MongoDB
mongosh "mongodb://localhost:27017/mdr-video-transcriptions" --eval "db.getCollection('video-transcriptions').deleteMany({videoId: 'rBG1Lty78lI'})"

# Run the test again
cd C:\Users\Renato\repos\lbt\video-transcription
bash test-transcription.sh
```

## Alternative: Pre-create the Bucket

If you don't want to give bucket creation permissions, you can create the bucket manually:

1. **Go to Cloud Storage**
   - Navigate to: **Cloud Storage** → **Buckets**
   - Click **CREATE BUCKET**

2. **Configure Bucket**
   - Name: `lbt-video-transcription-temp`
   - Location: Choose your preferred region
   - Storage class: **Standard**
   - Access control: **Uniform**
   - Click **CREATE**

3. **Grant Service Account Access**
   - Go to the bucket's **Permissions** tab
   - Click **GRANT ACCESS**
   - Add principal: `video-transcription-service@learnbytesting-ai.iam.gserviceaccount.com`
   - Role: **Storage Object Admin**
   - Click **SAVE**

Then the service will be able to upload files to the existing bucket.

## Bucket Configuration

The service uses these GCS settings (from `config/global.config.ts`):
- **Bucket Name**: `lbt-video-transcription-temp`
- **Purpose**: Temporary storage for large audio files (>10MB)
- **Retention**: Files are cleaned up after transcription
- **Location**: Defaults to project's default location

## Cost Considerations

**Google Cloud Storage Pricing:**
- Storage: ~$0.02 per GB per month (Standard storage)
- Operations: $0.05 per 10,000 operations
- Network egress: $0.12 per GB (to Speech-to-Text API - same region is free)

**For this use case:**
- Each audio file: ~50-100MB (for a 40-minute video)
- Stored temporarily: <1 hour
- Cost per transcription: ~$0.01 or less
- Monthly cost (100 transcriptions): ~$1-2

## Security Best Practices

1. **Use IAM Conditions** (Optional)
   - Limit service account to specific bucket
   - Set expiration dates for credentials
   - Restrict by IP if possible

2. **Enable Audit Logging**
   - Track all storage operations
   - Monitor for unusual activity

3. **Set Lifecycle Rules**
   - Auto-delete files older than 1 day
   - Prevent accumulation of temp files

## Troubleshooting

### Permission Changes Not Taking Effect
- Wait 1-2 minutes for propagation
- Restart the Node.js service
- Check IAM policy is correct in Console

### Still Getting Permission Errors
- Verify you're using the correct project ID
- Check service account email matches exactly
- Ensure Speech-to-Text API is enabled

### Bucket Already Exists Error
- The service will use existing bucket
- Make sure service account has access to it
- Check bucket name matches configuration

## Next Steps

After fixing permissions:
1. ✅ Restart the video-transcription service
2. ✅ Delete failed transcripts from MongoDB
3. ✅ Run the test script again
4. ✅ Verify transcription completes successfully

## References

- [Google Cloud Storage IAM Roles](https://cloud.google.com/storage/docs/access-control/iam-roles)
- [Service Account Permissions](https://cloud.google.com/iam/docs/service-accounts)
- [GCS Best Practices](https://cloud.google.com/storage/docs/best-practices)
