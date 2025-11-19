# Deploy Next.js in Kubernetes with Watt

In this guide, we are configuring and setting up a Next.js application in
very common enterprise environment: Kubernetes (K8s).

We will use Watt, the application server for Node.js, to set up:

1. metrics with Prometheus
2. multithreading server-side rendering
3. distributed caching with Redis/Valkey

Here is the highlight of the architecture:

![Next.js with Watt Architecture](./images/next-in-k8s.png)

## Create a new Next.js application (or use your own)

### Add Incremental Site Regeneration or 'use cache'

## Add `watt.json`

In order to run your existing Next.js application with Watt, you can use the import capability of `wattpm-utils`.

From the root of your application, run:

```
npx wattpm-utils import
```

The command will create a `watt.json` for you and also install `@platformatic/next` as part of your dependencies.

By default, Watt will run on random port. If you want to choose a specific port, add an entry in the `watt.json` file
with a `runtime` block. In the same block, we also need to add the configuration to support multithreading. Add it like
following:

```json
{
  ...
  "runtime": {
    "server": {
      "host": "0.0.0.0",
      "port": "{{PORT}}" 
    },
    "workers": {
      "static": "{{PLT_NEXT_WORKERS}}"
    }
  }
}
```

The `{{MYENV}}` syntax tells Watt to take that value from the process environment; `.env` loading is also fully supported.

You will also need to configure the Valkey connection string. Edit it and add:


```json
{
  ...
  "cache": {
    "adapter": "valkey"
    "url": "{{PLT_VALKEY_HOST}}
  }
}
```

At the end, your `watt.json` should match:

```json
{
  "$schema": "https://schemas.platformatic.dev/@platformatic/next/3.8.0.json",
  "runtime": {
    "server": {
      "host": "0.0.0.0",
      "port": "{{PORT}}" 
    },
    "workers": {
      "static": "{{PLT_NEXT_WORKERS}}"
    }
  },
  "cache": {
    "adapter": "valkey"
    "url": "{{PLT_VALKEY_HOST}}
  }
}
```

If you prefer, you can also use YAML format and use a `watt.yml`.

### Test it locally

To test this setup locally, you can spawn a Valkey image using Docker:

```sh
docker run -d -p 6379:6379 valkey/valkey:latest
```

Then write a `.env` file in your project, like so:

```
PORT=3000
PLT_VALKEY_HOST=localhost
PLT_NEXT_WORKERS=1
```

Then, run:

```sh
npx wattpm build
npx wattpm start
```

If you want to start a second copy of your application on a different port, you can with:

```
PORT=3001 npx wattpm start
```

(You can also run `wattpm dev` for development mode)

## Create and build the Docker image

In order to run our application inside Kubernetes, we need to build our Docker image first.
The most basic Dockerfile needed is:

```Dockerfile
FROM node:22-alpine

ENV APP_HOME=/home/app
ENV PORT=3042
ENV PLT_SERVER_LOGGER_LEVEL="info"
ENV PLT_NEXT_WORKERS="1"
ENV PLT_VALKEY_HOST="valkey"

RUN npm install -g pnpm
WORKDIR $APP_HOME
COPY ./ ./

RUN pnpm install && pnpm run build
EXPOSE 3042

CMD [ "pnpm", "run", "start" ]
```

Note that you might want to keep some of those environment variables loose and configure them via K8s.

### Building the image

There are a few different ways to build the image, depending on where your K8s cluster is running.
Assuming you are following this guide with a locally running k8s, these are the most common options.

#### Option A: Build using Docker Desktop or Local Docker

If you're using Docker Desktop or a local Docker daemon:

```bash
docker build -t next-app:latest .
```

#### Option B: Build using Minikube

If you're using Minikube, you need to use Minikube's Docker daemon:

```bash
eval $(minikube docker-env)
docker build -t next-app:latest .
```

#### Option C: Build using Kind

If you're using Kind, load the image into the cluster:

```bash
docker build -t next-app:latest .
kind load docker-image next-app:latest
```

### Verify the Image was Built

Check that the image exists:

```bash
docker images | grep next-app
```

You should see `next-app:latest` in the list.

## Deploy Prometheus and Valkey in K8s

### Start a K8S Cluster
In this example we will use Docker Desktop's built-in kubernetes cluster.

Enable the cluster from Docker Desktop main page 

![Docker Desktop Cluster](./images/docker-desktop-cluster.png)

### Helm

Install [helm](https://helm.sh/) for your system

### Deploy Valkey in the cluster

Create a file `valkey-overrides.yaml` to configure Valkey deploy configuration

```yaml
service:
  type: "NodePort"
auth:
  enabled: false
```

Then deploy valkey with the following command

```bash
helm upgrade --install valkey oci://registry-1.docker.io/cloudpirates/valkey \
  --values=valkey-overrides.yaml \
  --version=0.3.2
```

### Deploy Prometheus in the cluster

First, add the Prometheus community Helm repository:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
```

Create a file `prometheus-overrides.yaml` to configure Prometheus deploy configuration

```yaml
prometheus:
  service:
    type: NodePort
    nodePort: 30090

```

```bash
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --values=helm/prometheus-overrides.yaml \
  --namespace=monitoring \
  --create-namespace
```

## Deploy the application

You need 3 files to have a minimal installation: `deployment.yaml`, `service.yaml` and `podMonitor.yaml`.

### `deployment.yaml`

This file describe the deployment of your application.

TODO: add a description of the various configurations (limits, liveness and readiness)  and link to the other places

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: next-app
  labels:
    app: next-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: next-app
  template:
    metadata:
      labels:
        app: next-app
        platformatic.dev/monitor: prometheus
    spec:
      containers:
      - name: next-app
        image: next-app:latest
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: HOSTNAME
          value: "0.0.0.0"
        resources:
          requests:
            memory: "256Mi"
            cpu: "1000m"
          limits:
            memory: "1024Mi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
```

### `service.yaml`

TODO: add description

```yaml
apiVersion: v1
kind: Service
metadata:
  name: next-app-service
  labels:
    app: next-app
spec:
  type: NodePort
  selector:
    app: next-app
  ports:
  - port: 3000
    targetPort: 3000
    nodePort: 32100
    protocol: TCP
    name: http
```

### `podMonitor.yaml`

TODO: add description

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: next-app-pod-monitor
  namespace: default
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      # app: next-app
      platformatic.dev/monitor: prometheus
  podMetricsEndpoints:
  - honorLabels: false
    interval: 15s
    port: metrics
    path: /metrics
    relabelings:
    - action: replace
      sourceLabels:
      - __meta_kubernetes_pod_label_app_kubernetes_io_name
      targetLabel: name
    - action: replace
      sourceLabels:
      - __meta_kubernetes_pod_label_app_kubernetes_io_instance
      targetLabel: instance
```

Then you can apply all these files with the command

```bash
kubectl apply -f service.yaml -f deployment.yaml -f podMonitor.yaml
```

## Verify metrics

Open [http://localhost:32100](http://localhost:32100) to see your app running

Then open [http://localhost:30090](http://localhost:30090) to open Prometheus Dashboard

Start to type `nodejs` and if you see an autocomplete like the following image

![Prometheus Query](./images/prometheus-query.png)

you're done! 

Prometheus is now monitoring your app and collecting metrics!

TODO: add conclusion and recap
