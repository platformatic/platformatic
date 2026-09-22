import { drawChart, drawMiniChart, svgNode } from './charts.js'
import { COLORS, formatMetric, metricView, scalingWarnings, WorkerHistory } from './model.js'

const POLL_MS = 5000
const counts = new WorkerHistory()
const byId = id => document.getElementById(id)
let snapshot = null
let selectedId = new URL(window.location.href).searchParams.get('application')
let paused = false
let timer
let request
let resizeFrame
let chartDraws = []

function element (tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function age (timestamp) {
  if (timestamp == null) return 'No measurements'
  const seconds = Math.max(0, Math.floor((snapshot.now - timestamp) / 1000))
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`
}

function selectApplication (id) {
  selectedId = id
  const url = new URL(window.location.href)
  url.searchParams.set('application', id)
  window.history.replaceState(null, '', url)
  render()
}

function renderApplications () {
  const query = byId('search').value.toLowerCase()
  const list = byId('application-list')
  byId('application-count').textContent = `Applications (${snapshot.applications.length})`
  list.replaceChildren()
  for (const app of snapshot.applications) {
    if (!app.id.toLowerCase().includes(query)) continue
    const item = element('button', 'application-item')
    item.type = 'button'
    item.setAttribute('aria-pressed', String(app.id === selectedId))
    item.onclick = () => selectApplication(app.id)
    const title = element('div', 'item-title')
    title.append(element('span', 'item-name', app.id), element('span', 'item-count', `${app.liveCount} → ${app.targetCount}`))
    const values = []
    const predictions = []
    for (const name of ['elu', 'heap']) {
      const view = metricView(app, name, snapshot.now)
      if (!view) continue
      values.push(`${name.toUpperCase()}: ${formatMetric(name, view.current)}`)
      const future = view.forecast.at(-1)?.value
      if (future > view.threshold) predictions.push(`${name.toUpperCase()} predicted to → ${formatMetric(name, future)}`)
    }
    item.append(title, element('span', 'item-metrics', values.join('  |  ')))
    if (predictions.length) item.append(element('span', 'item-status overloaded', predictions.join(' · ')))
    if (app.pending.length) item.append(element('span', 'item-status', `${app.pending.length} worker${app.pending.length === 1 ? '' : 's'} starting`))
    list.append(item)
  }
  if (!list.childElementCount) list.append(element('p', 'empty', 'No applications found'))
}

function stat (parent, label, value) {
  const node = element('span', '', `${label} `)
  node.append(element('strong', '', value))
  parent.append(node)
}

function renderSummary (app) {
  const summary = byId('application-summary')
  const stats = element('div', 'summary-stats')
  stat(stats, 'Workers Usage', app.liveCount)
  stat(stats, 'Workers Scheduled', app.targetCount)
  stat(stats, 'Starting', app.pending.length)
  stat(stats, 'min', app.min)
  stat(stats, 'max', app.max)
  const details = element('div', 'summary-detail')
  details.textContent = `Estimated worker startup time: ${(app.initTimeoutMs / 1000).toFixed(1)}s`
  summary.replaceChildren(element('h2', '', app.id), stats, details)
  if (app.pending.length) {
    const overdue = app.pending.filter(pending => pending.scaleAt < snapshot.now).length
    const description = overdue
      ? `${overdue} worker${overdue === 1 ? ' is' : 's are'} taking longer than expected to start.`
      : `Waiting for ${app.pending.length} scheduled worker${app.pending.length === 1 ? '' : 's'} to start.`
    summary.append(element('p', 'summary-detail', description))
  }
}

function legendItem (label, color, dashed = false) {
  const item = element('span', 'legend-item')
  const swatch = element('span', `legend-swatch${dashed ? ' dashed' : ''}`)
  swatch.style.color = color
  item.append(swatch, document.createTextNode(label))
  return item
}

function chartCard (app, name) {
  const card = element('section', 'chart-card')
  const header = element('div', 'chart-header')
  const labels = { workers: 'WORKERS (#)', elu: 'AGGREGATED ELU', heap: 'AGGREGATED HEAP (MB)' }
  header.append(element('h3', '', labels[name]))
  const svg = svgNode('svg', { class: 'chart', role: 'img', 'aria-label': `${app.id}: ${labels[name]}` })
  const legend = element('div', 'legend')
  let chart
  if (name === 'workers') {
    const history = counts.get(app.id)
    chart = {
      history,
      threshold: app.max,
      forecast: [{ timestamp: snapshot.now, value: app.targetCount }, { timestamp: snapshot.now + 20000, value: app.targetCount }]
    }
    header.append(element('span', 'chart-values', `${app.liveCount} current · ${app.targetCount} scheduled`))
    legend.append(legendItem('Workers Usage', COLORS.workers), legendItem('Workers Scheduled', '#fff', true), legendItem(`Max (${app.max})`, '#cc2222', true))
  } else {
    chart = metricView(app, name, snapshot.now)
    if (!chart) {
      const message = element('p', 'empty', `${name.toUpperCase()} scaling is not configured for this application.`)
      if (name === 'heap') {
        message.append(
          element('br'),
          document.createTextNode('Set '),
          element('code', '', 'workers.heapThresholdMb'),
          document.createTextNode(' in your runtime configuration (or the application’s workers configuration) and restart WATT.'),
          element('br'),
          document.createTextNode('Choose a per-worker threshold in MB. This enables heap-based scaling as well as the charts.')
        )
      }
      card.append(header, message)
      return card
    }
    header.append(element('span', 'chart-values', `${formatMetric(name, chart.current)} · threshold ${formatMetric(name, chart.threshold)}`))
    legend.append(legendItem('Past', COLORS[name]), legendItem('Predicted', COLORS.forecast, true), legendItem('Threshold', '#cc2222', true))
  }
  card.append(header, svg, legend)
  chartDraws.push(() => drawChart(svg, { ...chart, name, now: snapshot.now, initTimeoutMs: app.initTimeoutMs, horizonMs: app.horizonMs }))
  return card
}

function renderWorkers (app) {
  byId('worker-title').textContent = `${app.id} (${app.liveCount} Workers)`
  const list = byId('worker-list')
  const scrollTop = list.scrollTop
  list.replaceChildren()
  for (const worker of app.workers) {
    const workerLabel = `Worker ${worker.id.match(/:(\d+)-\d+$/)?.[1] ?? worker.id}`
    const row = element('article', 'worker-row')
    const header = element('div', 'worker-header')
    header.append(element('span', '', workerLabel))
    const overloaded = ['elu', 'heap'].some(name => worker.metrics[name]?.value > app.metrics[name]?.threshold)
    if (overloaded) {
      const dot = element('span', 'status-dot')
      dot.setAttribute('aria-label', 'Last measurement above threshold')
      header.append(dot)
    }
    row.append(header, element('span', 'worker-meta', `Started ${age(worker.startTime)}`))
    const charts = element('div', 'mini-charts')
    for (const name of ['elu', 'heap']) {
      const metric = worker.metrics[name]
      const block = element('div')
      const title = element('div', 'mini-title', name.toUpperCase())
      const value = element('span', 'mini-value', formatMetric(name, metric?.value))
      value.style.color = COLORS[name]
      title.append(value)
      const svg = svgNode('svg', { class: 'mini-chart', role: 'img', 'aria-label': `${workerLabel}: ${name.toUpperCase()}` })
      drawMiniChart(svg, name, metric, snapshot.now, app.metrics[name]?.threshold)
      block.append(title, svg)
      if (!app.metrics[name] || !metric) {
        const status = !app.metrics[name] ? 'Not configured' : 'Awaiting first sample'
        block.append(element('span', 'mini-age', status))
      }
      charts.append(block)
    }
    row.append(charts)
    list.append(row)
  }
  if (!app.workers.length) list.append(element('p', 'empty', 'No live workers.'))
  list.scrollTop = scrollTop
}

function render () {
  if (!snapshot) return
  byId('tooltip').hidden = true
  const selected = snapshot.applications.find(app => app.id === selectedId) ?? snapshot.applications[0]
  selectedId = selected?.id ?? null
  const warnings = scalingWarnings(snapshot, selected)
  byId('warnings').replaceChildren(...warnings.map(message => element('p', '', message)))
  byId('warnings').hidden = !warnings.length || !byId('error').hidden
  renderApplications()
  chartDraws = []
  if (!selected) {
    byId('application-summary').replaceChildren(element('h2', '', 'No applications'))
    byId('charts').replaceChildren(element('p', 'empty', 'No applications available'))
    byId('worker-title').textContent = 'Workers'
    byId('worker-list').replaceChildren()
    return
  }
  renderSummary(selected)
  byId('charts').replaceChildren(...['workers', 'elu', 'heap'].map(name => chartCard(selected, name)))
  for (const draw of chartDraws) draw()
  renderWorkers(selected)
}

async function poll () {
  clearTimeout(timer)
  if (paused || document.hidden || request) return
  request = new AbortController()
  const timeout = setTimeout(() => request?.abort(new Error('Snapshot request timed out')), 10000)
  byId('refresh').disabled = true
  try {
    const response = await fetch('./snapshot', { signal: request.signal, cache: 'no-store' })
    if (!response.ok) throw new Error(`Autoscaler data unavailable (${response.status}).`)
    snapshot = await response.json()
    counts.update(snapshot)
    byId('error').hidden = true
    byId('connection').textContent = `Updated ${new Date(snapshot.now).toLocaleTimeString()}`
    render()
  } catch (error) {
    if (!paused && !document.hidden) {
      byId('error').textContent = `${error.message} Retrying in ${POLL_MS / 1000}s.`
      byId('error').hidden = false
      byId('warnings').hidden = true
      byId('connection').textContent = snapshot ? 'Disconnected · showing last update' : 'Disconnected'
    }
  } finally {
    clearTimeout(timeout)
    request = null
    byId('refresh').disabled = false
    if (!paused && !document.hidden) timer = setTimeout(poll, POLL_MS)
  }
}

function updatePolling () {
  clearTimeout(timer)
  if (paused || document.hidden) {
    request?.abort()
    byId('connection').textContent = paused ? 'Paused' : 'Paused while hidden'
  } else {
    poll()
  }
}

byId('search').addEventListener('input', () => { if (snapshot) renderApplications() })
byId('refresh').addEventListener('click', () => {
  paused = false
  byId('pause').textContent = 'Pause'
  byId('pause').setAttribute('aria-pressed', 'false')
  poll()
})
byId('pause').addEventListener('click', () => {
  paused = !paused
  byId('pause').textContent = paused ? 'Resume' : 'Pause'
  byId('pause').setAttribute('aria-pressed', String(paused))
  updatePolling()
})
document.addEventListener('visibilitychange', updatePolling)
window.addEventListener('pagehide', () => { clearTimeout(timer); request?.abort() })
new window.ResizeObserver(() => {
  window.cancelAnimationFrame(resizeFrame)
  resizeFrame = window.requestAnimationFrame(() => { for (const draw of chartDraws) draw() })
}).observe(byId('charts'))
poll()
