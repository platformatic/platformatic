import { formatMetric } from './model.js'

const applicationColors = new Map()
let nextColor = 0

function workerLabel (application, worker) {
  const index = worker.id.match(/:(\d+)-\d+$/)?.[1]
  if (index !== undefined) return `${application.id}:${index}`
  return worker.id
}

// The memory row shows worker heaps plus the headroom used by the scaler's
// admission check. System memory already in use is excluded from the bar.
export function resourceUsage (snapshot) {
  const workerSegments = []
  const heapSegments = []
  let live = 0
  let scheduled = 0
  let heapUsed = 0
  let missingHeap = 0

  for (const application of snapshot.applications) {
    for (const worker of application.workers) {
      const segment = {
        kind: 'worker',
        application: application.id,
        label: workerLabel(application, worker),
        value: 1
      }
      workerSegments.push(segment)
      live++
      const heap = worker.metrics.heap?.value
      if (Number.isFinite(heap) && heap >= 0) {
        if (heap > 0) heapSegments.push({ ...segment, value: heap })
        heapUsed += heap
      } else {
        missingHeap++
      }
    }
    const pending = Math.max(0, application.targetCount - application.liveCount)
    if (pending > 0) {
      workerSegments.push({
        kind: 'scheduled', application: application.id, label: `${application.id} · scheduled`, value: pending
      })
      scheduled += pending
    }
  }

  const limit = snapshot.maxTotalWorkers
  const occupied = live + scheduled
  const available = Math.max(0, limit - occupied)
  if (available > 0) workerSegments.push({ kind: 'available', label: 'Available', value: available })
  const workers = { limit, live, scheduled, occupied, available, scale: Math.max(limit, occupied, 1), segments: workerSegments }

  let memory = null
  if (Number.isFinite(snapshot.memory?.used) && Number.isFinite(snapshot.memory?.limit) && snapshot.memory.limit >= 0) {
    const { used, limit } = snapshot.memory
    const available = Math.max(0, limit - used)
    if (available > 0) heapSegments.push({ kind: 'available', label: 'Available for scale-up', value: available })
    memory = {
      heapUsed,
      available,
      missingHeap,
      scale: Math.max(heapUsed + available, 1),
      segments: heapSegments
    }
  }
  return { workers, memory }
}

function element (tag, className, text) {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function formatMemory (value) {
  const gigabyte = 1024 ** 3
  if (value >= gigabyte) return `${(value / gigabyte).toFixed(1)} GB`
  return formatMetric('heap', value)
}

function appColor (id) {
  if (!applicationColors.has(id)) {
    const hue = (210 + nextColor * 137.508) % 360
    applicationColors.set(id, `hsl(${hue} 55% 30%)`)
    nextColor++
  }
  return applicationColors.get(id)
}

function track (name, usage, onSelect) {
  const bar = element('div', `resource-track resource-track-${name}`)
  bar.setAttribute('role', 'group')
  bar.setAttribute('aria-label', `${name} allocation`)
  for (const segment of usage.segments) {
    let tag = 'div'
    if (segment.application) tag = 'button'
    const block = element(tag, `resource-segment resource-${segment.kind}`)
    block.style.flexGrow = String(segment.value)
    let label = segment.label
    if (name === 'memory') {
      label += ` · ${formatMemory(segment.value)}`
    } else if (segment.kind !== 'worker') {
      label += ` · ${segment.value}`
      block.style.setProperty('--slot-width', `${100 / segment.value}%`)
    }
    block.append(element('span', 'resource-segment-label', label))
    block.title = label
    block.setAttribute('aria-label', label)
    if (segment.application) {
      block.type = 'button'
      block.style.backgroundColor = appColor(segment.application)
      block.onclick = () => onSelect(segment.application)
    }
    bar.append(block)
  }
  if (name === 'workers' && usage.scale > usage.limit) {
    const marker = element('span', 'resource-limit-marker')
    marker.style.left = `${usage.limit / usage.scale * 100}%`
    marker.title = 'Configured limit'
    marker.setAttribute('aria-label', 'Configured limit')
    bar.append(marker)
  }
  return bar
}

export function renderResourceLimits (container, snapshot, onSelect) {
  const activeApplications = new Set(snapshot.applications.map(application => application.id))
  for (const id of applicationColors.keys()) {
    if (!activeApplications.has(id)) applicationColors.delete(id)
  }
  const { workers, memory } = resourceUsage(snapshot)
  const workerRow = element('div', 'resource-row')
  const workerHeader = element('div', 'resource-row-header')
  let workerSummary = `${workers.live} running · ${workers.available} available / ${workers.limit} slots`
  if (workers.scheduled > 0) workerSummary += ` · ${workers.scheduled} scheduled`
  if (workers.occupied > workers.limit) workerSummary += ` · ${workers.occupied - workers.limit} over limit`
  workerHeader.append(element('h3', '', 'Workers'), element('span', 'resource-values', workerSummary))
  workerRow.append(workerHeader, track('workers', workers, onSelect))

  const memoryRow = element('div', 'resource-row')
  const memoryHeader = element('div', 'resource-row-header')
  memoryHeader.append(element('h3', '', 'Heap Usage'))
  memoryRow.append(memoryHeader)
  if (memory) {
    const memorySummary = `${formatMemory(memory.available)} available for scale-up · ${formatMemory(memory.heapUsed)} worker heap`
    memoryHeader.append(element('span', 'resource-values', memorySummary))
    memoryRow.append(track('memory', memory, onSelect))
    if (memory.missingHeap > 0) {
      memoryRow.append(element('p', 'resource-note', `${memory.missingHeap} worker(s) awaiting a heap measurement.`))
    }
  } else {
    memoryRow.append(element('p', 'resource-note', 'Memory usage is not available yet.'))
  }
  container.replaceChildren(workerRow, memoryRow)
}
