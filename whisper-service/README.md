# Self-Hosted Whisper Service for LearnByTesting

A containerized OpenAI Whisper transcription service designed to run in your DigitalOcean Kubernetes cluster.

## 🎯 Benefits

- **95% cost savings** vs Google Cloud Speech-to-Text
- **4-10x cheaper** than OpenAI Whisper API
- **No API rate limits**
- **Full control** over processing
- **Runs in your existing K8s cluster** - no additional infrastructure

## 📊 Cost Analysis

### Transcribing 100 hours/month:

| Provider | Cost |
|----------|------|
| **Self-hosted (K8s)** | **~$0-12/month** |
| OpenAI API | $36/month |
| Google Cloud | $144/month |

**Annual Savings: $288-1,728!**

## 🚀 Quick Start

### 1. Build Docker Image

```bash
cd whisper-service

# Build image
docker build -t kasparov112000/learnbytesting-whisper-service:latest .

# Test locally
docker run -p 5000:5000 kasparov112000/learnbytesting-whisper-service:latest

# Test endpoint
curl http://localhost:5000/health
```

### 2. Push to DockerHub

```bash
docker login
docker push kasparov112000/learnbytesting-whisper-service:latest
```

### 3. Deploy to DigitalOcean K8s

```bash
# Make sure you're connected to your cluster
kubectl config current-context

# Deploy
kubectl apply -f k8s-deployment.yaml

# Check status
kubectl get pods -l app=whisper-service
kubectl logs -f deployment/whisper-service

# Get service URL (internal)
kubectl get svc whisper-service
```

### 4. Update Video Transcription Service

Update `.env` in video-transcription microservice:

```env
TRANSCRIPTION_PROVIDER=self-hosted
WHISPER_SERVICE_URL=http://whisper-service.default.svc.cluster.local:5000
```

Note: Use the Kubernetes service name if both are in the same cluster!

## 🔧 Configuration

### Model Selection

Choose model based on accuracy vs speed tradeoff:

| Model | Size | Speed | Quality | Memory |
|-------|------|-------|---------|--------|
| `tiny` | 75 MB | Very Fast | Good | 1 GB |
| `base` | 142 MB | **Fast** | **Very Good** | 2 GB |
| `small` | 466 MB | Medium | Excellent | 3 GB |
| `medium` | 1.5 GB | Slow | Best | 5 GB |

**Recommendation: Start with `base` model**

Edit `k8s-deployment.yaml`:
```yaml
env:
- name: WHISPER_MODEL
  value: "base"  # Change to: tiny, small, medium, large
```

### Resource Limits

Adjust based on your node capacity:

```yaml
resources:
  requests:
    memory: "2Gi"   # Minimum needed
    cpu: "1000m"    # 1 CPU core
  limits:
    memory: "4Gi"   # Maximum allowed
    cpu: "2000m"    # 2 CPU cores
```

**For tiny model**: Can reduce to 1GB memory
**For medium model**: Increase to 5-6GB memory

### Scaling

The deployment includes auto-scaling:
- **Min replicas**: 1 (always running)
- **Max replicas**: 3 (scale under load)
- **Scale triggers**: 70% CPU or 80% memory

To scale manually:
```bash
kubectl scale deployment whisper-service --replicas=2
```

To disable auto-scaling, remove the HPA section from `k8s-deployment.yaml`.

## 📈 Performance Benchmarks

**40-minute video transcription:**

| Setup | Time | CPU Used | Memory |
|-------|------|----------|--------|
| tiny model | 30 min | 1 core | 1 GB |
| base model | 60-90 min | 1 core | 2 GB |
| small model | 120 min | 1 core | 3 GB |
| medium model | 180 min | 1 core | 5 GB |

**With 2 CPU cores**: Reduce times by ~30-40%

## 🔍 Monitoring

```bash
# View logs
kubectl logs -f deployment/whisper-service

# Check resource usage
kubectl top pod -l app=whisper-service

# Check health
kubectl exec -it deployment/whisper-service -- curl localhost:5000/health

# Port forward for local testing
kubectl port-forward deployment/whisper-service 5000:5000
```

## 🧪 Testing

```bash
# Test health endpoint
curl http://whisper-service.default.svc.cluster.local:5000/health

# Test transcription (requires audio file)
curl -X POST http://whisper-service.default.svc.cluster.local:5000/transcribe \
  -F "audio=@test-audio.wav" \
  -F "language=en"
```

## 💰 Cost Optimization Tips

### 1. Use Smaller Model for Testing
- Start with `tiny` during development
- Upgrade to `base` or `small` for production

### 2. Scale to Zero When Idle
If you don't transcribe videos often, consider using Kubernetes Jobs instead:
```bash
# Jobs spin up only when needed, then terminate
# Pay only for actual processing time
```

### 3. Use Spot/Preemptible Nodes
- DigitalOcean doesn't have spot instances
- But you can use smaller node pool specifically for Whisper
- Example: $12/month node just for transcription

### 4. Process During Off-Peak Hours
- Queue transcription jobs
- Process overnight when cluster is idle
- Free compute if you have spare capacity!

## 🔒 Security

### Network Policy (Recommended)

Restrict access to only video-transcription service:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: whisper-service-policy
spec:
  podSelector:
    matchLabels:
      app: whisper-service
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: video-transcription
    ports:
    - protocol: TCP
      port: 5000
```

## 🐛 Troubleshooting

### Pod keeps restarting
```bash
# Check logs
kubectl logs deployment/whisper-service --previous

# Common issue: Not enough memory
# Solution: Increase memory limit or use smaller model
```

### Out of Memory (OOM) errors
```bash
# Use smaller model
WHISPER_MODEL=tiny

# Or increase memory limits
resources.limits.memory: "8Gi"
```

### Slow transcription
```bash
# Check CPU allocation
kubectl top pod -l app=whisper-service

# Increase CPU cores
resources.limits.cpu: "3000m"  # 3 cores

# Or use tiny model
WHISPER_MODEL=tiny
```

### Cannot connect from video-transcription
```bash
# Check service is running
kubectl get svc whisper-service

# Verify service URL in video-transcription .env:
# If same namespace: http://whisper-service:5000
# If different namespace: http://whisper-service.namespace.svc.cluster.local:5000
```

## 📦 Deployment Checklist

- [ ] Build Docker image
- [ ] Push to DockerHub
- [ ] Deploy to K8s cluster
- [ ] Verify pod is running
- [ ] Test health endpoint
- [ ] Update video-transcription .env
- [ ] Test end-to-end transcription
- [ ] Monitor resource usage
- [ ] Adjust replicas/resources as needed

## 🎓 Next Steps

1. **Test with real video**: Use the video-transcription API
2. **Monitor costs**: Track actual resource usage
3. **Optimize**: Adjust model size and resources
4. **Scale**: Add more replicas if needed
5. **Advanced**: Set up job queue for batch processing

## 📚 Additional Resources

- [OpenAI Whisper Documentation](https://github.com/openai/whisper)
- [Kubernetes Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [DigitalOcean Kubernetes](https://docs.digitalocean.com/products/kubernetes/)
