# Docker Setup for Video Transcription Microservice

**Date:** November 20, 2025
**Status:** ✅ Complete

## Overview

This document explains the Docker configuration for the video-transcription microservice. The Dockerfile uses a multi-stage build pattern for optimal image size and security.

## Dockerfile Structure

### Multi-Stage Build Pattern

The Dockerfile consists of 4 stages:

1. **BASE** (scratch) - Empty base for multi-stage reference
2. **BUILD** - Compiles TypeScript to JavaScript
3. **UNIT TESTING** - Optionally runs unit tests
4. **RUNTIME** - Production-ready minimal image

### Stage Details

#### Stage 1: BASE
```dockerfile
FROM scratch
```
- Empty stage used as a reference point for multi-stage builds

#### Stage 2: BUILD
```dockerfile
FROM node:18-alpine
WORKDIR /var/app
ADD package.json .
RUN npm install
COPY . .
RUN npm run build
```
- Uses Node.js 18 on Alpine Linux (minimal size)
- Installs all dependencies (including devDependencies)
- Compiles TypeScript to JavaScript
- Output is in `/var/app/dist`

#### Stage 3: UNIT TESTING
```dockerfile
FROM node:18-alpine
ARG UNIT_TEST=no
COPY --from=1 /var/app  /var/app
RUN if [ "${UNIT_TEST}" = "yes" ]; then npm test; fi
```
- Optional testing stage
- Only runs if `UNIT_TEST=yes` build argument is provided
- Uses compiled code from BUILD stage

#### Stage 4: RUNTIME
```dockerfile
FROM node:18-alpine
EXPOSE 3000

# Install FFmpeg for audio processing
RUN apk add --no-cache ffmpeg

WORKDIR /var/app
COPY --from=1 /var/app/package.json .
COPY --from=1 /var/app/dist .
COPY --from=1 /var/app/docs ./docs/
RUN npm install --production

ENTRYPOINT ["node", "./app/index.js"]
```
- Fresh Node.js 18 Alpine image
- **FFmpeg installed** for audio conversion (key difference from other microservices)
- Only production dependencies installed
- Compiled JavaScript from BUILD stage
- Exposes port 3000
- Runs the compiled application

## Key Differences from Questions Microservice

| Aspect | Questions | Video Transcription |
|--------|-----------|---------------------|
| FFmpeg | Not required | **Required** - Added via `apk add ffmpeg` |
| Package Name | `questions` | `video-transcription` |
| Package Version | `2.5` | `1.0` |
| Special Requirements | None | Audio/video processing |

## Building the Image

### Basic Build

```bash
cd C:\Users\Renato\repos\lbt\video-transcription

# Build with latest tag
docker build -t kasparov112000/learnbytesting-video-transcription-docker:latest .

# Build with specific tag
docker build -t kasparov112000/learnbytesting-video-transcription-docker:v1.0.0 .

# Build with commit SHA (recommended for production)
docker build -t kasparov112000/learnbytesting-video-transcription-docker:abc123def .
```

### Build with Unit Tests

```bash
docker build --build-arg UNIT_TEST=yes \
  -t kasparov112000/learnbytesting-video-transcription-docker:latest .
```

### Build for Multiple Platforms

```bash
# For both AMD64 and ARM64
docker buildx build --platform linux/amd64,linux/arm64 \
  -t kasparov112000/learnbytesting-video-transcription-docker:latest \
  --push .
```

## Running the Container

### Run Locally

```bash
docker run -d \
  --name video-transcription \
  -p 3016:3000 \
  -e ENV_NAME=LOCAL \
  -e MONGODB_URL=mongodb://host.docker.internal:27017/mdr-video-transcriptions \
  -e TRANSCRIPTION_PROVIDER=openai \
  -e OPENAI_API_KEY=sk-your-key-here \
  kasparov112000/learnbytesting-video-transcription-docker:latest
```

### Run with Environment File

```bash
# Create .env.docker file
cat > .env.docker << EOF
ENV_NAME=LOCAL
MONGODB_URL=mongodb://host.docker.internal:27017/mdr-video-transcriptions
TRANSCRIPTION_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
TEMP_AUDIO_DIR=/tmp/audio
CLEANUP_TEMP_FILES=true
EOF

# Run with env file
docker run -d \
  --name video-transcription \
  -p 3016:3000 \
  --env-file .env.docker \
  kasparov112000/learnbytesting-video-transcription-docker:latest
```

### Run with Volume for Audio Files

```bash
docker run -d \
  --name video-transcription \
  -p 3016:3000 \
  -v /tmp/video-transcription-audio:/tmp/audio \
  -e ENV_NAME=LOCAL \
  kasparov112000/learnbytesting-video-transcription-docker:latest
```

## Pushing to DockerHub

### Login to DockerHub

```bash
docker login
# Enter username: kasparov112000
# Enter password: [your-token]
```

### Push Image

```bash
# Push latest
docker push kasparov112000/learnbytesting-video-transcription-docker:latest

# Push specific version
docker push kasparov112000/learnbytesting-video-transcription-docker:v1.0.0

# Push commit SHA
docker push kasparov112000/learnbytesting-video-transcription-docker:abc123def
```

### Tag and Push Multiple Versions

```bash
# Build and tag
docker build -t kasparov112000/learnbytesting-video-transcription-docker:latest .
docker tag kasparov112000/learnbytesting-video-transcription-docker:latest \
  kasparov112000/learnbytesting-video-transcription-docker:v1.0.0

# Push both
docker push kasparov112000/learnbytesting-video-transcription-docker:latest
docker push kasparov112000/learnbytesting-video-transcription-docker:v1.0.0
```

## Image Size Optimization

The multi-stage build pattern significantly reduces the final image size:

- **Stage 2 (BUILD):** ~500MB (includes dev dependencies, TypeScript, build tools)
- **Stage 4 (RUNTIME):** ~200MB (only production deps, compiled JS, FFmpeg)

### Size Comparison

```bash
# View image size
docker images kasparov112000/learnbytesting-video-transcription-docker

# Expected output:
# REPOSITORY                                              TAG       SIZE
# learnbytesting-video-transcription-docker              latest    ~200MB
```

## Environment Variables

The following environment variables can be set when running the container:

### Required
- `MONGODB_URL` - MongoDB connection string
- `TRANSCRIPTION_PROVIDER` - `google` or `openai`

### Optional
- `ENV_NAME` - Environment name (default: `deployed`)
- `PORT` - Server port (default: `3000`)
- `OPENAI_API_KEY` - OpenAI API key (if using OpenAI provider)
- `GOOGLE_CLOUD_PROJECT_ID` - Google Cloud project ID (if using Google provider)
- `GOOGLE_APPLICATION_CREDENTIALS` - Path to Google credentials JSON
- `TEMP_AUDIO_DIR` - Temporary audio directory (default: `/tmp/audio`)
- `CLEANUP_TEMP_FILES` - Auto-cleanup temp files (default: `true`)
- `MAX_VIDEO_LENGTH_SECONDS` - Max video duration (default: `7200`)

## Verifying the Build

### Check Image Contents

```bash
# List files in the image
docker run --rm kasparov112000/learnbytesting-video-transcription-docker:latest \
  ls -la /var/app

# Check FFmpeg installation
docker run --rm kasparov112000/learnbytesting-video-transcription-docker:latest \
  ffmpeg -version

# Verify Node.js version
docker run --rm kasparov112000/learnbytesting-video-transcription-docker:latest \
  node --version
```

### Test the Container

```bash
# Start container
docker run -d --name test-transcription \
  -p 3016:3000 \
  -e ENV_NAME=LOCAL \
  -e MONGODB_URL=mongodb://host.docker.internal:27017/mdr-video-transcriptions \
  kasparov112000/learnbytesting-video-transcription-docker:latest

# Wait for startup
sleep 5

# Test health endpoint
curl http://localhost:3016/health

# Expected response:
# {"status":"ok","service":"video-transcription","timestamp":"..."}

# View logs
docker logs test-transcription

# Stop and remove
docker stop test-transcription
docker rm test-transcription
```

## Troubleshooting

### Build Fails at npm install

**Error:**
```
npm ERR! code ENOTFOUND
npm ERR! syscall getaddrinfo
```

**Solution:**
- Check internet connection
- Try with `--network=host` flag:
  ```bash
  docker build --network=host -t video-transcription .
  ```

### FFmpeg Not Found in Container

**Error:**
```
Error: FFmpeg not found
```

**Solution:**
- Verify FFmpeg installation in Dockerfile:
  ```bash
  docker run --rm video-transcription ffmpeg -version
  ```
- FFmpeg should be installed in RUNTIME stage via `apk add ffmpeg`

### Image Size Too Large

**Problem:** Image is larger than expected (>300MB)

**Solutions:**
1. Ensure using `--production` flag for npm install
2. Verify `.dockerignore` excludes unnecessary files
3. Check that multi-stage build is working correctly

### Container Exits Immediately

**Problem:** Container starts but exits immediately

**Diagnosis:**
```bash
docker logs <container-id>
```

**Common Causes:**
- MongoDB connection failure
- Missing required environment variables
- Application crash during startup

**Solution:**
```bash
# Run with interactive shell to debug
docker run -it --rm \
  -e ENV_NAME=LOCAL \
  video-transcription sh

# Inside container, try running manually
node ./app/index.js
```

### TypeScript Compilation Errors

**Error:** Build fails during `npm run build`

**Solution:**
1. Test build locally first:
   ```bash
   npm run build
   ```
2. Fix TypeScript errors
3. Verify `tsconfig.json` is correct
4. Ensure all dependencies in `package.json`

## Security Best Practices

### Don't Include Secrets in Image

❌ **DON'T:**
```dockerfile
ENV OPENAI_API_KEY=sk-actual-key-here
ENV MONGO_PASSWORD=actual-password
```

✅ **DO:**
```bash
# Pass secrets at runtime
docker run -e OPENAI_API_KEY=$OPENAI_API_KEY ...
```

### Use Specific Tags

❌ **DON'T:**
```yaml
image: video-transcription:latest
```

✅ **DO:**
```yaml
image: video-transcription:v1.0.0
# or even better
image: video-transcription:abc123def
```

### Scan for Vulnerabilities

```bash
# Using Docker scan
docker scan kasparov112000/learnbytesting-video-transcription-docker:latest

# Using Trivy
trivy image kasparov112000/learnbytesting-video-transcription-docker:latest
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to DockerHub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          token: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: |
            kasparov112000/learnbytesting-video-transcription-docker:latest
            kasparov112000/learnbytesting-video-transcription-docker:${{ github.sha }}
          build-args: |
            UNIT_TEST=yes
```

## Maintenance

### Regular Updates

```bash
# Update base image
docker pull node:18-alpine

# Rebuild with updated base
docker build --no-cache \
  -t kasparov112000/learnbytesting-video-transcription-docker:latest .
```

### Cleanup Old Images

```bash
# Remove unused images
docker image prune -a

# Remove specific old versions
docker rmi kasparov112000/learnbytesting-video-transcription-docker:old-tag
```

## Performance Optimization

### Use BuildKit

```bash
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
docker build -t video-transcription .
```

### Build Cache

```bash
# Use cache from previous build
docker build --cache-from video-transcription:latest \
  -t video-transcription:new-version .
```

## Summary

✅ **Multi-stage build** reduces final image size
✅ **FFmpeg included** for audio/video processing
✅ **Production-only dependencies** for security
✅ **Node.js 18 Alpine** for minimal footprint
✅ **Port 3000 exposed** for service communication
✅ **Environment variable driven** for flexibility

---

**Next Steps:**
1. Build the Docker image
2. Test locally with Docker
3. Push to DockerHub
4. Deploy via Helm chart to Kubernetes
5. Set up CI/CD pipeline

For Kubernetes deployment, see `helm/HELM_SETUP.md`.
