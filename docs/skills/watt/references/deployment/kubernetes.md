# Kubernetes Deployment for Platformatic Watt

Build a major 3 Watt image with Node.js 22.19.0+ using the [Docker guide](docker.md).
The manifests below are templates: choose measured resources, an immutable image tag,
and real application health endpoints. `/health` is an application route, not a
universal Watt endpoint. Watt's default runtime probes are `/ready` and `/status` on
the configured probe/metrics server; align probe ports and paths with that configuration.

Ensure the configured listener uses `PORT` and binds to `0.0.0.0`. Budget workers,
replicas, database pools, startup time, and termination grace time together. With a
read-only root filesystem, provide writable mounts for temporary files and caches.

## Directory Structure

Create a `k8s/` directory with these files:
```
k8s/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml
├── deployment.yaml
├── service.yaml
├── hpa.yaml
└── ingress.yaml
```

## Namespace

`k8s/namespace.yaml`:
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: watt-app
  labels:
    app.kubernetes.io/name: watt-app
```

## ConfigMap

`k8s/configmap.yaml`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: watt-app-config
  namespace: watt-app
data:
  NODE_ENV: "production"
  PLT_SERVER_HOSTNAME: "0.0.0.0"
  PLT_SERVER_LOGGER_LEVEL: "info"
  PORT: "3000"
```

## Secret

`k8s/secret.yaml`:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: watt-app-secrets
  namespace: watt-app
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:password@db:5432/myapp"
  SESSION_SECRET: "your-session-secret-here"
  # Add other secrets as needed
```

**Note**: In production, use external secret management (Vault, AWS Secrets Manager, etc.)

## Deployment

`k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: watt-app
  namespace: watt-app
  labels:
    app.kubernetes.io/name: watt-app
    app.kubernetes.io/component: server
spec:
  replicas: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: watt-app
  template:
    metadata:
      labels:
        app.kubernetes.io/name: watt-app
    spec:
      containers:
        - name: watt-app
          image: your-registry/watt-app:release
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: watt-app-config
            - secretRef:
                name: watt-app-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 0
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 30
          securityContext:
            runAsNonRoot: true
            runAsUser: 1001
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
      securityContext:
        fsGroup: 1001
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app.kubernetes.io/name: watt-app
                topologyKey: kubernetes.io/hostname
```

## Service

`k8s/service.yaml`:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: watt-app-service
  namespace: watt-app
  labels:
    app.kubernetes.io/name: watt-app
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP
  selector:
    app.kubernetes.io/name: watt-app
```

## Horizontal Pod Autoscaler

`k8s/hpa.yaml`:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: watt-app-hpa
  namespace: watt-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: watt-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
```

## Ingress

`k8s/ingress.yaml` (using nginx-ingress):
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: watt-app-ingress
  namespace: watt-app
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - app.example.com
      secretName: watt-app-tls
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: watt-app-service
                port:
                  number: 80
```

## Deployment Commands

```bash
# Create namespace first
kubectl apply -f k8s/namespace.yaml

# Apply all manifests
kubectl apply -f k8s/

# Or apply individually in order
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml

# Check deployment status
kubectl -n watt-app get pods
kubectl -n watt-app get deployments
kubectl -n watt-app get services

# View logs
kubectl -n watt-app logs -l app.kubernetes.io/name=watt-app -f

# Describe pod for troubleshooting
kubectl -n watt-app describe pod <pod-name>

# Scale deployment manually
kubectl -n watt-app scale deployment watt-app --replicas=5

# Rolling update
kubectl -n watt-app set image deployment/watt-app watt-app=your-registry/watt-app:v2.0.0

# Rollback
kubectl -n watt-app rollout undo deployment/watt-app

# Check rollout status
kubectl -n watt-app rollout status deployment/watt-app
```

## Pod Disruption Budget

`k8s/pdb.yaml`:
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: watt-app-pdb
  namespace: watt-app
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: watt-app
```

## Network Policy

`k8s/networkpolicy.yaml`:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: watt-app-network-policy
  namespace: watt-app
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: watt-app
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 5432  # PostgreSQL
        - protocol: TCP
          port: 6379  # Redis
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
         - protocol: UDP
           port: 53
         - protocol: TCP
           port: 53
```

## Resource Quotas

`k8s/resourcequota.yaml`:
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: watt-app-quota
  namespace: watt-app
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 4Gi
    limits.cpu: "8"
    limits.memory: 8Gi
    pods: "20"
```

## Helm Chart

For production, consider using Helm. Basic structure:
```
watt-app-chart/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── hpa.yaml
│   └── ingress.yaml
```

`values.yaml`:
```yaml
replicaCount: 3

image:
  repository: your-registry/watt-app
  tag: latest
  pullPolicy: Always

service:
  type: ClusterIP
  port: 80

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: app.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: watt-app-tls
      hosts:
        - app.example.com
```
