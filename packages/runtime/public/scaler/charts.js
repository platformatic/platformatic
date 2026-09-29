import { COLORS, formatMetric, WINDOW_MS } from './model.js'

const NS = 'http://www.w3.org/2000/svg'
let nextId = 0

export function svgNode (tag, attributes = {}, text) {
  const node = document.createElementNS(NS, tag)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value)
  if (text !== undefined) node.textContent = text
  return node
}

function path (points, x, y, step = false) {
  return points.map((point, i) => {
    const coordinates = `${x(point.timestamp)},${y(point.value)}`
    if (i === 0) return `M${coordinates}`
    return step ? `H${x(point.timestamp)}V${y(point.value)}` : `L${coordinates}`
  }).join(' ')
}

function line (parent, x1, y1, x2, y2, attributes = {}) {
  parent.append(svgNode('line', { x1, y1, x2, y2, ...attributes }))
}

function drawSeries (parent, points, x, y, color, { dashed = false, step = false, fill, bottom } = {}) {
  if (!points.length) return
  const d = path(points, x, y, step)
  if (fill && points.length > 1) {
    parent.append(svgNode('path', {
      d: `${d} L${x(points.at(-1).timestamp)},${bottom} L${x(points[0].timestamp)},${bottom} Z`, fill
    }))
  }
  parent.append(svgNode('path', {
    d, fill: 'none', stroke: color, 'stroke-width': 1.7, 'stroke-dasharray': dashed ? '6 4' : 'none'
  }))
  if (points.length === 1) parent.append(svgNode('circle', { cx: x(points[0].timestamp), cy: y(points[0].value), r: 3, fill: color }))
}

export function drawChart (svg, { name, now, history, forecast = [], threshold, initTimeoutMs }) {
  const width = Math.max(280, svg.getBoundingClientRect().width)
  const height = Math.max(125, svg.getBoundingClientRect().height)
  // Share plot bounds so time markers align across all metric charts.
  const left = 64
  const top = 28
  const right = width - 46
  const bottom = height - 24
  const color = COLORS[name]
  const id = `chart-${nextId++}`
  const start = now - WINDOW_MS
  const end = now + 20000
  const points = [...history, ...forecast].filter(point => Number.isFinite(point.value))
  const max = Math.max(name === 'workers' ? 2 : name === 'elu' ? 1 : 1e6, threshold ?? 0, ...points.map(point => point.value))
  const yMax = name === 'elu' ? 1 : name === 'workers' ? Math.ceil(max * 1.15) : max * 1.12
  const x = timestamp => left + (timestamp - start) / (end - start) * (right - left)
  const y = value => bottom - value / yMax * (bottom - top)
  // ICC extends the last displayed slope beyond the prediction horizon,
  // bounded by the chart's axis. This is presentation only.
  const last = forecast.at(-1)
  if (name !== 'workers' && last && last.timestamp < end) {
    const previous = forecast.at(-2)
    let value = last.value
    if (previous && last.timestamp > previous.timestamp) {
      const slope = (last.value - previous.value) / (last.timestamp - previous.timestamp)
      value += slope * (end - last.timestamp)
    }
    forecast = [...forecast, { timestamp: end, value: Math.max(0, Math.min(yMax, value)) }]
  }
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.replaceChildren()

  const defs = svgNode('defs')
  const gradient = svgNode('linearGradient', { id: `${id}-gradient`, x1: 0, y1: 0, x2: 0, y2: 1 })
  gradient.append(svgNode('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.25 }), svgNode('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }))
  const hatch = svgNode('pattern', { id: `${id}-hatch`, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' })
  line(hatch, 0, 0, 0, 7, { stroke: '#ffffff09', 'stroke-width': 2 })
  const clip = svgNode('clipPath', { id: `${id}-clip` })
  clip.append(svgNode('rect', { x: left, y: top, width: right - left, height: bottom - top }))
  defs.append(gradient, hatch, clip)
  svg.append(defs, svgNode('rect', { x: x(now), y: top, width: right - x(now), height: bottom - top, fill: `url(#${id}-hatch)` }))

  let ticks = [0, yMax / 2, yMax]
  if (name === 'workers') {
    const step = Math.max(1, Math.ceil(yMax / Math.max(5, Math.floor((bottom - top) / 18))))
    ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, index) => index * step)
    if (ticks.at(-1) !== yMax) ticks.push(yMax)
  }
  for (const value of ticks) {
    line(svg, left, y(value), right, y(value), { stroke: '#1a1e23' })
    svg.append(svgNode('text', { x: left - 8, y: y(value) + 3, 'text-anchor': 'end' }, formatMetric(name, value)))
    if (name === 'workers') {
      svg.append(svgNode('text', { x: right + 8, y: y(value) + 3, 'text-anchor': 'start' }, formatMetric(name, value)))
    }
  }
  for (let seconds = -60; seconds <= 20; seconds += 10) {
    if (seconds === 0) continue
    svg.append(svgNode('text', { x: x(now + seconds * 1000), y: height - 5, 'text-anchor': 'middle' }, `${seconds > 0 ? '+' : ''}${seconds}s`))
  }
  const plot = svgNode('g', { 'clip-path': `url(#${id}-clip)` })
  if (Number.isFinite(threshold)) line(plot, left, y(threshold), right, y(threshold), { stroke: '#cc2222', 'stroke-dasharray': '5 4' })
  drawSeries(plot, history, x, y, color, { step: name === 'workers', fill: `url(#${id}-gradient)`, bottom })
  drawSeries(plot, forecast, x, y, name === 'workers' ? '#ffffffa0' : COLORS.forecast, { dashed: true })
  svg.append(plot)

  line(svg, x(now), top, x(now), bottom, { stroke: '#ffffffb0' })
  svg.append(svgNode('text', { x: left, y: 10, class: 'region-label' }, '◄ PAST'))
  svg.append(svgNode('text', { x: right, y: 10, class: 'region-label', 'text-anchor': 'end' }, name === 'workers' ? 'SCHEDULED ►' : 'PREDICTED ►'))
  svg.append(svgNode('text', { x: x(now), y: top - 5, class: 'region-label', 'text-anchor': 'middle' }, 'NOW'))
  if (initTimeoutMs > 0 && initTimeoutMs < 20000) {
    const initX = x(now + initTimeoutMs)
    line(svg, initX, top, initX, bottom, { stroke: '#4d5054', 'stroke-dasharray': '6 4' })
    if (initX - x(now) > 28) svg.append(svgNode('text', { x: initX, y: top - 5, class: 'region-label', 'text-anchor': 'middle' }, 'INIT'))
  }
  if (!history.length && !forecast.length) {
    svg.append(svgNode('text', { x: (left + right) / 2, y: (top + bottom) / 2, 'text-anchor': 'middle' }, 'Waiting for measurements'))
  }
  const tooltipPoints = [...history, ...forecast]
  installTooltip(svg, tooltipPoints, x, y, name, { left, right, top, bottom, width, height })
}

function installTooltip (svg, points, x, y, name, bounds) {
  const tooltip = document.getElementById('tooltip')
  const crosshair = svgNode('line', { y1: bounds.top, y2: bounds.bottom, stroke: '#ffffff50', 'stroke-dasharray': '3 3', visibility: 'hidden' })
  svg.append(crosshair)
  svg.onpointermove = event => {
    const rect = svg.getBoundingClientRect()
    const mx = (event.clientX - rect.left) / rect.width * bounds.width
    const my = (event.clientY - rect.top) / rect.height * bounds.height
    if (mx < bounds.left || mx > bounds.right || my < bounds.top || my > bounds.bottom || !points.length) {
      svg.onpointerleave()
      return
    }
    let nearest = points[0]
    let distance = Infinity
    for (const point of points) {
      const candidate = Math.abs(x(point.timestamp) - mx) + Math.abs(y(point.value) - my) * 0.1
      if (candidate < distance) { nearest = point; distance = candidate }
    }
    crosshair.setAttribute('x1', x(nearest.timestamp))
    crosshair.setAttribute('x2', x(nearest.timestamp))
    crosshair.setAttribute('visibility', 'visible')
    tooltip.textContent = formatMetric(name, nearest.value)
    tooltip.hidden = false
    tooltip.style.left = `${Math.max(8, Math.min(event.clientX + 12, window.innerWidth - tooltip.offsetWidth - 8))}px`
    tooltip.style.top = `${Math.max(8, event.clientY - tooltip.offsetHeight - 12)}px`
  }
  svg.onpointerleave = () => {
    tooltip.hidden = true
    crosshair.setAttribute('visibility', 'hidden')
  }
}

export function drawMiniChart (svg, name, metric, now, threshold) {
  const width = 160
  const height = 55
  const history = (metric?.history ?? []).filter(point => Number.isFinite(point.value))
  if (Number.isFinite(metric?.value) && metric.lastSampleAt >= now - WINDOW_MS && metric.lastSampleAt > (history.at(-1)?.timestamp ?? 0)) {
    history.push({ timestamp: metric.lastSampleAt, value: metric.value })
  }
  const max = Math.max(name === 'elu' ? 1 : 1e6, threshold ?? 0, ...history.map(point => point.value)) * 1.1
  const x = timestamp => 2 + (timestamp - (now - WINDOW_MS)) / WINDOW_MS * (width - 4)
  const y = value => height - 3 - value / max * (height - 6)
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  if (Number.isFinite(threshold)) line(svg, 0, y(threshold), width, y(threshold), { stroke: '#cc2222', 'stroke-dasharray': '4 3' })
  drawSeries(svg, history, x, y, COLORS[name])
  if (!metric) svg.append(svgNode('text', { x: width / 2, y: height / 2, fill: '#898d94', 'font-size': 10, 'text-anchor': 'middle' }, 'No measurements'))
}
