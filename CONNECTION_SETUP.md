# Connection Configuration Setup

**Date:** November 20, 2025
**Status:** ✅ Complete

## What Was Configured

The video-transcription microservice has been updated to use the standard connection configuration pattern used by other LBT microservices (similar to the questions microservice).

### MongoDB Configuration

- **Database Name:** `mdr-video-transcriptions`
- **Collection Name:** `video-transcriptions`
- **Connection URL:** `mongodb://localhost:27017/mdr-video-transcriptions`

### Files Created/Modified

#### 1. Created `config/connection.ts`
New connection configuration file following the LBT microservices pattern:
- Uses `hipolito-framework` ConnectionConfig class
- Database name: `mdr-video-transcriptions` (from env `MONGO_NAME` or default)
- Model name: `VideoTranscriptions`
- Schema path: Points to `app/models` directory
- Supports both local (mongodb://) and production (mongodb+srv://) connections
- Connection pooling configured (default 100 connections)

#### 2. Updated `app/models/transcript.model.ts`
- Changed collection name from `'transcripts'` to `'video-transcriptions'`
- This ensures MongoDB uses the correct collection name

#### 3. Updated Environment Variables
Modified the following files to use the new database name:
- `.env` - Changed to `mdr-video-transcriptions`
- `.env.template` - Updated default value
- `config/global.config.ts` - Updated default mongoDbUrl

#### 4. Updated Documentation
- `README.md` - Updated all database references
- `SETUP_COMPLETE.md` - Updated configuration examples

#### 5. Installed Dependency
- Added `hipolito-framework@^1.0.13` to package.json

## Connection Configuration Details

### Environment Variables

The connection can be configured via environment variables:

```env
# Database name (default: mdr-video-transcriptions)
MONGO_NAME=mdr-video-transcriptions

# Host (default: 127.0.0.1)
MONGO_HOST=127.0.0.1

# Port (default: 27017)
MONGO_PORT=27017

# Credentials (optional)
MONGO_USER=
MONGO_PASSWORD=

# SSL (default: false)
MONGO_SSL=false

# Pool size (default: 100)
MONGO_POOL_SIZE=100
```

### Connection Behavior

**Local Environment (`ENV_NAME=LOCAL`):**
- Uses standard MongoDB connection: `mongodb://host:port/database`
- Default host: `127.0.0.1`
- Default port: `27017`

**Production Environment:**
- Uses MongoDB Atlas connection: `mongodb+srv://host/database`
- Requires credentials for authentication
- Enables retryWrites by default

## Verification

### Service Status
✅ Service running on port 3016
✅ Connected to MongoDB successfully
✅ Database: `mdr-video-transcriptions`
✅ Collection: `video-transcriptions`

### Test Commands

```bash
# Check health endpoint
curl http://localhost:3016/health

# Expected response:
# {"status":"ok","service":"video-transcription","timestamp":"2025-11-20T22:56:25.637Z"}

# Verify MongoDB database and collection
mongosh "mongodb://127.0.0.1:27017/mdr-video-transcriptions" --eval "db.getName(); db.getCollectionNames()"

# Expected output:
# mdr-video-transcriptions
# [ 'video-transcriptions' ]
```

## Benefits of This Configuration

1. **Consistency:** Matches the pattern used by other LBT microservices (questions, exams, etc.)
2. **Flexibility:** Easy to switch between local and production MongoDB instances
3. **Environment-based:** All settings configurable via environment variables
4. **Connection Pooling:** Optimized for performance with connection reuse
5. **Standard Framework:** Uses `hipolito-framework` ConnectionConfig like other services

## Usage in Code

To use the connection configuration in your code:

```typescript
import { connection } from '../config/connection';

// The connection object handles:
// - Database connection
// - Model registration
// - Schema loading from app/models
// - Connection pooling
// - Environment-specific settings
```

## Next Steps

The connection is now configured and working. You can:

1. **Add more models:** Place new model files in `app/models/` and they'll be automatically loaded
2. **Configure for production:** Update environment variables in production deployment
3. **Scale connection pool:** Adjust `MONGO_POOL_SIZE` if needed for high load

## Troubleshooting

### Connection Issues

If the service can't connect to MongoDB:

1. **Check MongoDB is running:**
   ```bash
   powershell -Command "Get-Service MongoDB"
   ```

2. **Verify database URL in logs:**
   Look for "Connecting to MongoDB..." in service startup logs

3. **Test connection manually:**
   ```bash
   mongosh "mongodb://127.0.0.1:27017/mdr-video-transcriptions" --eval "db.stats()"
   ```

### Collection Not Found

If the collection doesn't exist yet, it will be automatically created when the first document is inserted.

## Related Files

- `/config/connection.ts` - Connection configuration
- `/config/global.config.ts` - Service global configuration
- `/app/models/transcript.model.ts` - Transcript schema and model
- `/app/server.ts` - Server initialization (uses mongoose.connect)
- `.env` - Environment variables

---

**Note:** This configuration follows the same pattern as the questions microservice (`/questions/config/connection.ts`) to maintain consistency across the LBT project.
