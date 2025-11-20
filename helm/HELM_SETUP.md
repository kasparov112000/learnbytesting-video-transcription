# Helm Chart Setup for Video Transcription Microservice

**Date:** November 20, 2025
**Status:** ✅ Complete

## Overview

This Helm chart enables Kubernetes deployment of the video-transcription microservice following the same pattern as the questions microservice.

## Helm Chart Structure

```
helm/
├── Chart.yaml                          # Chart metadata
├── values.yaml                         # Configuration values
├── templates/
│   ├── _helpers.tpl                   # Template helpers
│   ├── deployment.yaml                # Kubernetes Deployment
│   ├── service.yaml                   # Kubernetes Service
│   ├── serviceaccount.yaml            # Service Account
│   ├── ingress.yaml                   # Ingress (optional)
│   ├── hpa.yaml                       # Horizontal Pod Autoscaler (optional)
│   ├── NOTES.txt                      # Post-install notes
│   └── tests/
│       └── test-connection.yaml       # Helm test
└── HELM_SETUP.md                      # This file
```

## Chart Configuration

### Chart.yaml
- **Name:** `video-transcription`
- **Version:** `0.1.0`
- **App Version:** `v1`
- **Type:** `application`

### Key Values in values.yaml

```yaml
# Docker image
image:
  repository: kasparov112000/learnbytesting-video-transcription-docker
  tag: "latest"
  pullPolicy: Always

# Service configuration
service:
  type: ClusterIP
  port: 3016

# Replica count
replicaCount: 1

# Autoscaling (disabled by default)
autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
```

## Environment Variables

The deployment configures the following environment variables:

### MongoDB Configuration
- `ENV_NAME`: `DEVELOPMENT`
- `MONGO_HOST`: `cluster0.tvmkw.mongodb.net`
- `MONGO_PORT`: `27017`
- `MONGO_NAME`: `mdr-video-transcriptions`
- `MONGO_USER`: `dbAdmin`
- `MONGO_PASSWORD`: `ramos111` (⚠️ Should be moved to Kubernetes secrets)

### Transcription Configuration
- `TRANSCRIPTION_PROVIDER`: `openai`
- `OPENAI_API_KEY`: Empty (⚠️ Should be set via Kubernetes secret)
- `TEMP_AUDIO_DIR`: `/tmp/audio`
- `CLEANUP_TEMP_FILES`: `true`

## Deployment Details

### Container Configuration
- **Container Port:** `3000` (production port)
- **Service Port:** `3016` (exposed port)
- **Health Check:** `GET /health` on port 3000
- **Readiness Probe:**
  - Initial Delay: 5 seconds
  - Period: 3 seconds

### Resource Management
Resources are not limited by default. To set limits, modify `values.yaml`:

```yaml
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi
```

## Installation Commands

### Install the Chart

```bash
# Install with default values
helm install video-transcription ./helm

# Install with custom release name
helm install my-transcription ./helm

# Install with custom values
helm install video-transcription ./helm \
  --set image.tag=v1.2.3 \
  --set replicaCount=2
```

### Upgrade the Chart

```bash
# Upgrade with new image tag
helm upgrade video-transcription ./helm \
  --set image.tag=abc123def

# Upgrade with new values file
helm upgrade video-transcription ./helm \
  -f custom-values.yaml
```

### Uninstall the Chart

```bash
helm uninstall video-transcription
```

## Testing the Deployment

### Run Helm Tests

```bash
helm test video-transcription
```

### Check Deployment Status

```bash
# Get pods
kubectl get pods -l app.kubernetes.io/name=video-transcription

# Get service
kubectl get svc -l app.kubernetes.io/name=video-transcription

# View logs
kubectl logs -l app.kubernetes.io/name=video-transcription

# Check health endpoint
kubectl port-forward svc/video-transcription 3016:3016
curl http://localhost:3016/health
```

## Security Considerations

### ⚠️ Important: Secrets Management

The following sensitive values should NOT be hardcoded in `deployment.yaml`:

1. **MongoDB Password:** Move to Kubernetes Secret
2. **OpenAI API Key:** Move to Kubernetes Secret

### Recommended Setup with Secrets

1. **Create Kubernetes Secret:**
```bash
kubectl create secret generic video-transcription-secrets \
  --from-literal=mongo-password='ramos111' \
  --from-literal=openai-api-key='sk-your-key-here'
```

2. **Update deployment.yaml to use secrets:**
```yaml
env:
  - name: MONGO_PASSWORD
    valueFrom:
      secretKeyRef:
        name: video-transcription-secrets
        key: mongo-password
  - name: OPENAI_API_KEY
    valueFrom:
      secretKeyRef:
        name: video-transcription-secrets
        key: openai-api-key
```

## Integration with CI/CD

### GitHub Actions Workflow

The chart can be deployed via GitHub Actions:

```yaml
- name: Deploy to Kubernetes
  run: |
    helm upgrade --install video-transcription ./helm \
      --set image.tag=${{ github.sha }} \
      --set replicaCount=2
```

### DockerHub Integration

The chart expects images from:
```
kasparov112000/learnbytesting-video-transcription-docker:latest
```

## Scaling

### Manual Scaling

```bash
# Scale to 3 replicas
kubectl scale deployment video-transcription --replicas=3

# Or via Helm
helm upgrade video-transcription ./helm --set replicaCount=3
```

### Auto-scaling (HPA)

Enable Horizontal Pod Autoscaler in `values.yaml`:

```yaml
autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
```

## Monitoring

### Health Checks

The deployment includes:
- **Readiness Probe:** Ensures pod is ready before receiving traffic
- **Endpoint:** `GET /health` on port 3000

### Logs

```bash
# Stream logs
kubectl logs -f -l app.kubernetes.io/name=video-transcription

# Get logs from specific pod
kubectl logs video-transcription-<pod-id>
```

## Networking

### Service Type: ClusterIP
- Internal cluster communication only
- Accessed via service name: `video-transcription`
- Port: 3016

### Accessing from Other Services

From other pods in the cluster:
```
http://video-transcription:3016
```

### Port Forwarding for Local Testing

```bash
kubectl port-forward svc/video-transcription 3016:3016
# Access at http://localhost:3016
```

## Differences from Questions Microservice

| Aspect | Questions | Video Transcription |
|--------|-----------|---------------------|
| Service Port | 3011 | 3016 |
| Database | mdr-questions | mdr-video-transcriptions |
| Docker Image | learnbytesting-questions-docker | learnbytesting-video-transcription-docker |
| Health Endpoint | /healthcheck | /health |
| Extra Config | None | Transcription provider, API keys |

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod -l app.kubernetes.io/name=video-transcription

# Check logs
kubectl logs -l app.kubernetes.io/name=video-transcription
```

### ImagePullBackOff Error

- Verify Docker image exists: `kasparov112000/learnbytesting-video-transcription-docker:latest`
- Check image pull secrets are configured: `regcred`

### MongoDB Connection Error

- Verify MongoDB credentials in environment variables
- Check network connectivity to MongoDB cluster
- Ensure MongoDB allows connections from Kubernetes cluster IPs

### Health Check Failing

- Verify service is responding on port 3000
- Check `/health` endpoint returns 200 status
- Review application logs for startup errors

## Best Practices

1. **Use Secrets:** Never hardcode credentials in deployment.yaml
2. **Set Resource Limits:** Define CPU and memory limits for production
3. **Enable Autoscaling:** Use HPA for production deployments
4. **Monitor Logs:** Set up centralized logging
5. **Use Specific Tags:** Avoid `latest` tag in production, use commit SHA
6. **Health Checks:** Ensure health endpoint is always responsive
7. **Graceful Shutdown:** Handle SIGTERM signals properly

## Production Checklist

- [ ] Move secrets to Kubernetes Secrets
- [ ] Set resource limits and requests
- [ ] Enable autoscaling (HPA)
- [ ] Configure monitoring and alerting
- [ ] Set up centralized logging
- [ ] Use specific image tags (not `latest`)
- [ ] Configure ingress if external access needed
- [ ] Set up network policies
- [ ] Enable pod security policies
- [ ] Configure backup strategy for MongoDB

## Next Steps

1. **Create Docker Image:** Build and push the Docker image
2. **Set Up Secrets:** Move sensitive data to Kubernetes secrets
3. **Deploy to Development:** Test deployment in dev cluster
4. **Configure CI/CD:** Automate deployment via GitHub Actions
5. **Set Up Monitoring:** Configure logging and metrics
6. **Production Deploy:** Deploy to production cluster

---

**Note:** This Helm chart follows the same structure and patterns as the questions microservice (`/questions/helm`) for consistency across the LBT project.
