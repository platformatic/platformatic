export const WINDOW_MS = 60000
export const COLORS = { workers: '#2588E4', elu: '#C61BE2', heap: '#00BCD4', forecast: '#FEB928' }

export function formatMetric (name, value) {
  if (!Number.isFinite(value)) return '—'
  if (name === 'elu') return `${Math.round(value * 100)}%`
  if (name === 'heap') return `${(value / 1024 / 1024).toFixed(1)} MB`
  return String(Math.round(value))
}

// Current constraints, not a record of rejected scaling decisions.
export function scalingWarnings (snapshot, selected) {
  const warnings = []
  const scheduled = snapshot.applications.reduce((sum, app) => sum + app.targetCount, 0)
  if (scheduled >= snapshot.maxTotalWorkers) {
    warnings.push(`Total worker limit reached (${scheduled}/${snapshot.maxTotalWorkers} scheduled, including pending starts). More capacity requires workers.total to be increased or workers to be released.`)
  }
  if (snapshot.memory && snapshot.memory.used >= snapshot.memory.limit) {
    warnings.push(`Memory limit reached (${formatMetric('heap', snapshot.memory.used)} / ${formatMetric('heap', snapshot.memory.limit)}). Scale-up is blocked until memory is available.`)
  }
  if (selected?.targetCount >= selected?.max) {
    warnings.push(`${selected.id}: application worker limit reached (${selected.targetCount}/${selected.max} scheduled). Increase its workers.maximum to allow more workers.`)
  }
  if (selected) {
    const overdue = selected.pending.filter(pending => pending.scaleAt < snapshot.now).length
    if (overdue) warnings.push(`${selected.id}: ${overdue} scheduled worker${overdue === 1 ? ' is' : 's are'} taking longer than expected to start.`)
  }
  return warnings
}

// A view of the retained Holt state, not a second execution of the decision
// algorithm. Normalize future load by approved capacity, including pending starts.
export function metricView (app, name, now) {
  const metric = app.metrics[name]
  if (!metric) return null
  const max = name === 'elu' ? 1 : Infinity
  const clamp = value => Math.max(0, Math.min(max, value))
  const history = metric.history
    .filter(point => Number.isFinite(point.value) && point.timestamp >= now - WINDOW_MS)
    .map(point => ({ ...point, value: clamp(point.value) }))
  const forecast = []
  if (metric.level !== null && metric.lastProcessedTick && app.targetCount > 0) {
    const trend = metric.trend * 1000 / metric.sampleIntervalMs
    const end = now + app.horizonMs
    for (const timestamp of [now, end]) {
      const value = (metric.level + trend * (timestamp - metric.lastProcessedTick) / 1000) / app.targetCount
      if (Number.isFinite(value)) forecast.push({ timestamp, value: clamp(value) })
    }
    // Preserve the slope until it reaches a display bound, then flatten there
    // (ICC's generatePredictionPoints). Clamping just the endpoints changes it.
    const bound = trend > 0 ? max : 0
    if (trend !== 0 && Number.isFinite(bound)) {
      const crossing = metric.lastProcessedTick + (bound * app.targetCount - metric.level) / trend * 1000
      if (crossing > now && crossing < end) {
        forecast.splice(1, 0, { timestamp: Math.round(crossing), value: bound })
      }
    }
  }
  return { history, forecast, threshold: metric.threshold, current: history.at(-1)?.value ?? null }
}

// Counts have no server-side history. Keep only observations made by this page,
// bounded in both time and size. Never invent history before the first request.
export class WorkerHistory {
  #applications = new Map()

  update (snapshot) {
    const active = new Set()
    for (const app of snapshot.applications) {
      active.add(app.id)
      let points = this.#applications.get(app.id) ?? []
      const start = snapshot.now - WINDOW_MS
      points = points.filter(point => point.timestamp < snapshot.now)
      // Keep the count in effect at the left edge of the step chart.
      points = points.filter((point, index) => point.timestamp >= start || index === points.length - 1 || points[index + 1].timestamp > start)
      if (points[0]?.timestamp < start) points[0] = { ...points[0], timestamp: start }
      points.push({ timestamp: snapshot.now, value: app.liveCount })
      this.#applications.set(app.id, points.slice(-120))
    }
    for (const id of this.#applications.keys()) {
      if (!active.has(id)) this.#applications.delete(id)
    }
  }

  get (id) {
    return this.#applications.get(id) ?? []
  }
}
