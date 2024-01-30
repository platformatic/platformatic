# Monitoring with Prometheus and Grafana

[Prometheus](https://prometheus.io/) is open source system and alerting toolkit for monitoring and alerting. It's a time series database that collects metrics from configured targets at given intervals, evaluates rule expressions, displays the results, and can trigger alerts if some condition is observed to be true.
[Grafana](https://grafana.com/oss/grafana/) is an open source visualization and analytics software. 

It's a pretty common solution to use Prometheus to collect and store monitoring data, and Grafana to visualize it.

Platformatic can be configured to expose Prometheus metrics: 

```json
...
  "metrics": {
    "port": 9091,
    "auth": {
      "username": "platformatic",
      "password": "mysecret"
    }
  }
...
```

In this case, we are exposing the metrics on port 9091 (defaults to `9090`), and we are using basic authentication to protect the endpoint.
We can also specify the IP address to bind to (defaults to `0.0.0.0`). 
Note that the metrics port is not the default in this configuration. This is because if you want to test the integration running both Prometheus and Platformatic on the same host, Prometheus starts on `9090` port too.

Prometheus recommends using a port different from the main application port for serving the metrics. But, it is possible to serve metrics on the same port as the application by setting `"server": "parent"` in the `metrics` configuration. It is also possible to change the endpoint on which metrics are being served by passing the `endpoint` property. The following example configuration illustrates this:

```json
...
  "metrics": {
    "server": "parent",
    "endpoint": "/platformatic-app-metrics",
    "auth": {
      "username": "platformatic",
      "password": "mysecret"
    }
  }
...
```

All the configuration settings are optional. To use the default settings, set `"metrics": true`. See the [configuration reference](/reference/db/configuration.md#metrics) for more details.

:::caution
Use [environment variable placeholders](/reference/db/configuration.md#environment-variable-placeholders) in your Platformatic DB configuration file to avoid exposing credentials.
:::

## Prometheus Configuration
This is an example of a minimal Prometheus configuration to scrape the metrics from Platformatic:

```yaml
global:
  scrape_interval: 15s
  scrape_timeout: 10s
  evaluation_interval: 1m
scrape_configs:
  - job_name: 'platformatic'
    scrape_interval: 2s
    metrics_path: /metrics
    scheme: http
    basic_auth:
      username: platformatic
      password: mysecret
    static_configs:
      - targets: ['192.168.69.195:9091']
        labels:
          group: 'platformatic'
```

We specify a `target` configuring the IP address and the port where Platformatic is running, and we specify the `username` and `password` to use for basic authentication. The `metrics` path is the one used by Platformatic. The `ip` address is not a loopback address so this will work even with Prometheus running in docker on the same host (see below), please change it to your host ip.

To test this configuration, we can run Prometheus locally using [`docker`](https://docs.docker.com/get-docker/) and [`docker-compose`](https://docs.docker.com/compose/install/), so please be sure to have both correctly installed.
Save the above configuration in a file named `./prometheus/prometheus.yml` and create a `docker-compose.yml`: 

```yaml
version: "3.7"

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - prometheus_data:/prometheus
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    ports:
      - '9090:9090'

volumes:
  prometheus_data: {}

```

Then run `docker-compose up -d` and open `http://localhost:9090` in your browser. You should see the Prometheus dashboard, and you can also query the metrics, e.g. `{group="platformatic"}`. See [Prometheus docs](https://prometheus.io/docs/introduction/overview/) for more information on querying and metrics.

## Grafana Configuration

Let's see how we can configure Grafana to chart some Platformatics metrics from Prometheus. 
Change the `docker-compose.yml` to add a `grafana` service:

```yaml
version: "3.7"
services:

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - prometheus_data:/prometheus
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
    ports:
      - '9090:9090'

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=pleasechangeme
    depends_on:
      - prometheus
    ports:
      - '3000:3000'

volumes:
  prometheus_data: {}
  grafana_data: {}

```

In Grafana, select `Configuration` -> `Data Sources` -> `Add Data Source`, and select Prometheus.
In the URL field, specify the URL of the Prometheus server, e.g. `http://prometheus:9090` (the name of the service in the `docker-compose` file), then Save & Test.

Now we can create a dashboard and add panels to it. Select the Prometheus data source, and add queries. You should see the metrics exposed by Platformatic.

It's also possible to import pre-configured dashboards, like [this one](https://grafana.com/grafana/dashboards/12230-node-js-dashboard/) from Grafana.com.


