import { ok } from 'node:assert'

export const expectedMetrics = [
  {
    name: 'nodejs_active_handles',
    type: 'gauge'
  },
  {
    name: 'nodejs_active_handles_total',
    type: 'gauge'
  },
  {
    name: 'nodejs_active_requests',
    type: 'gauge'
  },
  {
    name: 'nodejs_active_requests_total',
    type: 'gauge'
  },
  {
    name: 'nodejs_active_resources',
    type: 'gauge'
  },
  {
    name: 'nodejs_active_resources_total',
    type: 'gauge'
  },
  {
    name: 'nodejs_eventloop_lag_max_seconds',
    type: 'gauge'
  },
  {
    name: 'nodejs_eventloop_lag_mean_seconds',
    type: 'gauge'
  },
  {
    name: 'nodejs_eventloop_lag_min_seconds',
    type: 'gauge'
  },
  {
    name: 'nodejs_eventloop_lag_p50_seconds',
    type: 'gauge'
  },
  {
    name: 'nodejs_eventloop_lag_p90_seconds',
    type: 'gauge'
  },
  {
    name: 'nodejs_eventloop_lag_p99_seconds',
    type: 'gauge'
  },
  {
    name: 'nodejs_eventloop_lag_seconds',
    type: 'gauge'
  },
  {
    name: 'nodejs_eventloop_lag_stddev_seconds',
    type: 'gauge'
  },
  {
    name: 'nodejs_eventloop_utilization',
    type: 'gauge'
  },
  {
    name: 'nodejs_external_memory_bytes',
    type: 'gauge'
  },
  {
    name: 'nodejs_gc_duration_seconds',
    type: 'histogram'
  },
  {
    name: 'nodejs_heap_size_total_bytes',
    type: 'gauge'
  },
  {
    name: 'nodejs_heap_size_used_bytes',
    type: 'gauge'
  },
  {
    name: 'nodejs_heap_space_size_available_bytes',
    type: 'gauge'
  },
  {
    name: 'nodejs_heap_space_size_total_bytes',
    type: 'gauge'
  },
  {
    name: 'nodejs_heap_space_size_used_bytes',
    type: 'gauge'
  },
  {
    name: 'nodejs_version_info',
    type: 'gauge'
  },
  {
    name: 'process_cpu_percent_usage',
    type: 'gauge'
  },
  {
    name: 'process_cpu_seconds_total',
    type: 'counter'
  },
  {
    name: 'process_cpu_system_seconds_total',
    type: 'counter'
  },
  {
    name: 'process_cpu_user_seconds_total',
    type: 'counter'
  },
  {
    name: 'process_resident_memory_bytes',
    type: 'gauge'
  },
  {
    name: 'process_start_time_seconds',
    type: 'gauge'
  },
  {
    name: 'http_request_all_summary_seconds',
    type: 'summary'
  },
  {
    name: 'http_request_all_duration_seconds',
    type: 'histogram'
  }
]

function assertSummary (metrics, metric) {
  ok(metrics.includes(`${metric.name}{quantile="0.01"`))
  ok(metrics.includes('http_request_all_summary_seconds{quantile="0.01"'))
  ok(metrics.includes('http_request_all_summary_seconds{quantile="0.05"'))
  ok(metrics.includes('http_request_all_summary_seconds{quantile="0.5"'))
  ok(metrics.includes('http_request_all_summary_seconds{quantile="0.9"'))
  ok(metrics.includes('http_request_all_summary_seconds{quantile="0.95"'))
  ok(metrics.includes('http_request_all_summary_seconds{quantile="0.99"'))
  ok(metrics.includes('http_request_all_summary_seconds{quantile="0.999"'))
  ok(metrics.includes('http_request_all_summary_seconds_sum{'))
  ok(metrics.includes('http_request_all_summary_seconds_count{'))
}

function assertHistogram (metrics, metric) {
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="0.005"'))
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="0.01"'))
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="0.025"'))
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="0.05"'))
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="0.1"'))
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="0.25"'))
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="0.5"'))
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="1"'))
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="2.5"'))
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="5"'))
  ok(metrics.includes('http_request_all_duration_seconds_bucket{le="10"'))
  ok(metrics.includes('http_request_all_duration_seconds_sum{'))
  ok(metrics.includes('http_request_all_duration_seconds_count{'))
}

export function assertMetric (metrics, metric) {
  ok(metrics.includes(`# HELP ${metric.name} `), `Metric ${metric.name} not found`)
  ok(metrics.includes(`# TYPE ${metric.name} ${metric.type}`), `Metric ${metric.name} type ${metric.type} not found`)

  if (metric.type === 'summary') {
    assertSummary(metrics, metric)
  } else if (metric.type === 'histogram') {
    assertHistogram(metrics, metric)
  }
}
