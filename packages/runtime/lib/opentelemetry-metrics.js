export class OpenTelemetryMetricsForwarder {
  #config
  #exporter
  #logger
  #queue
  #timer
  #flushing

  constructor (config, logger) {
    this.#config = config
    this.#logger = logger
    this.#queue = []
    this.#timer = null
    this.#flushing = false
  }

  async start () {
    if (!this.#config || this.#config.enabled === false || this.#config.enabled === 'false' || !this.#config.endpoint) {
      return false
    }

    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-proto')
    this.#exporter = new OTLPMetricExporter({
      url: this.#config.endpoint,
      headers: this.#config.headers
    })

    const interval = this.#config.interval ?? 60000
    this.#timer = setInterval(() => {
      this.flush().catch(error => {
        this.#logger.error({ err: error }, 'OpenTelemetry metrics export failed.')
      })
    }, interval)
    this.#timer.unref()

    return true
  }

  collect (resourceMetrics) {
    if (!this.#exporter) {
      return
    }

    this.#queue.push(resourceMetrics)
  }

  async flush () {
    if (!this.#exporter || this.#flushing || this.#queue.length === 0) {
      return
    }

    this.#flushing = true
    const batch = this.#queue.splice(0)

    try {
      await Promise.all(batch.map(resourceMetrics => this.#export(resourceMetrics)))
    } finally {
      this.#flushing = false
    }
  }

  async close () {
    if (this.#timer) {
      clearInterval(this.#timer)
      this.#timer = null
    }

    try {
      await this.flush()
    } catch (error) {
      this.#logger.error({ err: error }, 'OpenTelemetry metrics export failed.')
    }

    if (this.#exporter) {
      await this.#exporter.shutdown()
      this.#exporter = null
    }
  }

  #export (resourceMetrics) {
    const { promise, resolve, reject } = Promise.withResolvers()

    this.#exporter.export(resourceMetrics, result => {
      if (result.code === 0) {
        resolve()
      } else {
        reject(result.error ?? new Error('OpenTelemetry metrics export failed.'))
      }
    })

    return promise
  }
}
