// Merges the metrics of all the workers of each application into a single set of
// series without the worker label, so that the number of exported series does not
// grow with the number of workers.
//
// - Counters and histograms are cumulative and are summed. The aggregator keeps the
//   last values reported by each worker: when a worker is replaced or exits, or its
//   registry is reset, its last values are carried forward. Without this, every worker
//   restart would make the merged series decrease, and Prometheus would interpret it
//   as a reset of the whole series.
// - Gauges and the metrics which are reset after each collection are merged with the
//   metric `aggregator` (sum by default), without carrying anything forward.
// - Summaries are reported per worker, since quantiles cannot be merged.
//
// The totals of cumulative metrics are kept across collections and only updated with
// the difference between the current and the previous values of each worker: the values
// of a worker which is gone or has reset are simply never subtracted. Since the series of
// a worker are reported in the same order on each collection, each label set is matched
// with the one found at the same position in the previous collection, and a lookup key is
// only computed for new or moved label sets.

const kSeparator = '\u0000'
const kDuplicateSeparator = '\u0001'
const kBucketLabel = 'le'

const aggregators = {
  sum (values) {
    let total = 0
    for (const value of values) {
      total += value
    }
    return total
  },
  average (values) {
    return aggregators.sum(values) / values.length
  },
  min (values) {
    return values.reduce((min, value) => Math.min(min, value), Infinity)
  },
  max (values) {
    return values.reduce((max, value) => Math.max(max, value), -Infinity)
  },
  first (values) {
    return values[0]
  }
}

function getOrCreate (map, key, create) {
  let value = map.get(key)

  if (value === undefined) {
    value = create()
    map.set(key, value)
  }

  return value
}

function removeLabels (labels, first, second) {
  const result = {}

  for (const name in labels) {
    if (name !== first && name !== second) {
      result[name] = labels[name]
    }
  }

  return result
}

function getLabelsKey (metricName, labels) {
  let key = metricName ?? ''

  for (const name of Object.keys(labels).sort()) {
    key += kSeparator + name + kSeparator + labels[name]
  }

  return key
}

// Same as getLabelsKey, but avoids sorting the label names of each label set: they are sorted once
// and cached in the holder. Label sets with names not in the cache use the sorted key, which is the same.
function getCachedLabelsKey (holder, metricName, labels, count) {
  holder.labelNames ??= Object.keys(labels).sort()

  let key = metricName ?? ''
  let found = 0

  for (const name of holder.labelNames) {
    if (Object.hasOwn(labels, name)) {
      key += kSeparator + name + kSeparator + labels[name]
      found++
    }
  }

  return found === count ? key : getLabelsKey(metricName, labels)
}

// Checks if two samples belong to the same label set, ignoring the bucket label
function hasSameLabels (previous, current) {
  let count = 0

  for (const name in current) {
    if (name === kBucketLabel) {
      continue
    }

    if (previous[name] !== current[name]) {
      return false
    }

    count++
  }

  for (const name in previous) {
    if (name !== kBucketLabel) {
      count--
    }
  }

  return count === 0
}

function createValue (metricName, labels, value) {
  const result = { value, labels }

  if (metricName !== undefined) {
    result.metricName = metricName
  }

  return result
}

// The samples of cumulative metrics are organized in groups, one for each label set
// (ignoring the bucket label). For histograms, a group contains the buckets, the sum
// and the count. The layout of a group lists the metric name and the bucket of each
// of its samples: all the groups of a metric usually share the same layout object.
function createLayout (family, metricNames, buckets) {
  for (const layout of family.layouts) {
    if (hasLayout(layout, metricNames, buckets)) {
      return layout
    }
  }

  const sumName = family.type === 'histogram' ? `${family.name}_sum` : null
  const layout = {
    metricNames,
    buckets,
    length: metricNames.length,
    // The sum of a histogram can legitimately decrease with negative observations
    sumIndex: sumName === null ? -1 : metricNames.indexOf(sumName)
  }

  family.layouts.push(layout)
  return layout
}

function hasLayout (layout, metricNames, buckets) {
  if (layout.length !== metricNames.length) {
    return false
  }

  for (let i = 0; i < layout.length; i++) {
    if (layout.metricNames[i] !== metricNames[i] || layout.buckets[i] !== buckets[i]) {
      return false
    }
  }

  return true
}

function findSample (layout, metricName, bucket) {
  for (let i = 0; i < layout.length; i++) {
    if (layout.metricNames[i] === metricName && layout.buckets[i] === bucket) {
      return i
    }
  }

  return -1
}

function createTotalFamily ({ name, help, type, aggregator }) {
  return { name, help, type, aggregator, groups: new Map(), layouts: [], labelNames: undefined }
}

// Checks if the samples starting at the given position match the layout
function matchesLayout (layout, samples, start) {
  const end = start + layout.length

  if (end > samples.length) {
    return false
  }

  for (let i = 0; i < layout.length; i++) {
    const sample = samples[start + i]

    if (sample.metricName !== layout.metricNames[i] || sample.labels[kBucketLabel] !== layout.buckets[i]) {
      return false
    }
  }

  const first = samples[start].labels

  // The samples belong to the same label set, and the next sample does not belong to the group
  return (
    (layout.length === 1 || hasSameLabels(first, samples[end - 1].labels)) &&
    (end === samples.length || !continuesGroup(first, layout.metricNames, layout.buckets, samples[end]))
  )
}

// Checks if a sample belongs to the group of the given label set, unless it repeats one of its samples
function continuesGroup (labels, metricNames, buckets, sample) {
  if (!hasSameLabels(labels, sample.labels)) {
    return false
  }

  const bucket = sample.labels[kBucketLabel]

  for (let i = 0; i < metricNames.length; i++) {
    if (metricNames[i] === sample.metricName && buckets[i] === bucket) {
      return false
    }
  }

  return true
}

function getOutputLabels (group) {
  if (group.outputLabels === null) {
    const { labels, layout } = group
    const shared = Object.freeze({ ...labels })

    group.outputLabels = layout.buckets.map(bucket =>
      bucket === undefined ? shared : Object.freeze({ [kBucketLabel]: bucket, ...labels })
    )
  }

  return group.outputLabels
}

function toMetric (family) {
  const values = []

  for (const group of family.groups.values()) {
    const { metricNames, length } = group.layout
    const labels = getOutputLabels(group)

    for (let i = 0; i < length; i++) {
      values.push(createValue(metricNames[i], labels[i], group.values[i]))
    }
  }

  return { name: family.name, help: family.help, type: family.type, aggregator: family.aggregator, values }
}

export class WorkerMetricsAggregator {
  #workerLabel
  #nonCumulativeMetrics
  // Totals of the cumulative metrics: applicationId -> { families }
  #applications
  // State of each worker: key -> { application, families }
  #workers
  // Incremented on each aggregation, it marks what was reported in the current one
  #epoch

  constructor ({ workerLabel = 'workerId', nonCumulativeMetrics = [] } = {}) {
    this.#workerLabel = workerLabel
    this.#nonCumulativeMetrics = new Set(nonCumulativeMetrics)
    this.#applications = new Map()
    this.#workers = new Map()
    this.#epoch = 0
  }

  // Each item in workers is { key, applicationId, metrics }, where key identifies the
  // worker instance and metrics is the output of getMetricsAsJSON(), or null if the worker
  // could not be queried. A tracked worker which is missing from the list is considered
  // gone. Carried values of applications not included in applicationIds are discarded.
  aggregate (workers, applicationIds) {
    const epoch = ++this.#epoch
    const output = new Map()
    const queried = new Set()

    for (const { key, applicationId, metrics } of workers) {
      queried.add(key)

      // The worker is temporarily unavailable, its last cumulative values are still in the totals
      if (!metrics) {
        continue
      }

      const application = getOrCreate(this.#applications, applicationId, () => ({ families: new Map() }))
      let worker = this.#workers.get(key)

      if (worker === undefined || worker.application !== application) {
        worker = { application, families: new Map() }
        this.#workers.set(key, worker)
      }

      const entries = getOrCreate(output, applicationId, () => new Map())

      for (const metric of metrics) {
        const entry = getOrCreate(entries, metric.name, () => this.#createEntry(metric))

        if (entry.mode === 'summary') {
          entry.metrics.push(metric)
        } else if (entry.mode === 'cumulative') {
          this.#updateCumulativeMetric(worker, metric, epoch)
        } else {
          this.#groupValues(entry, metric)
        }
      }

      // A metric which is no longer reported has been removed from the registry: its last values stay in the totals
      for (const [name, family] of worker.families) {
        if (family.epoch !== epoch) {
          worker.families.delete(name)
        }
      }
    }

    // The values of the workers which are gone stay in the totals
    for (const key of this.#workers.keys()) {
      if (!queried.has(key)) {
        this.#workers.delete(key)
      }
    }

    for (const applicationId of this.#applications.keys()) {
      if (!applicationIds.has(applicationId)) {
        this.#applications.delete(applicationId)
      }
    }

    return this.#buildMetrics(output)
  }

  #createEntry (metric) {
    let mode = 'merge'

    if (metric.type === 'summary') {
      mode = 'summary'
    } else if (
      (metric.type === 'counter' || metric.type === 'histogram') &&
      !this.#nonCumulativeMetrics.has(metric.name)
    ) {
      mode = 'cumulative'
    }

    return {
      mode,
      name: metric.name,
      help: metric.help,
      type: metric.type,
      aggregator: metric.aggregator,
      metrics: [],
      groups: new Map()
    }
  }

  #updateCumulativeMetric (worker, metric, epoch) {
    const total = getOrCreate(worker.application.families, metric.name, () => createTotalFamily(metric))
    let family = worker.families.get(metric.name)

    if (family === undefined || family.total !== total) {
      family = { total, groups: new Map(), order: [], epoch }
      worker.families.set(metric.name, family)
    }

    family.epoch = epoch

    const samples = metric.values
    const previousOrder = family.order
    const order = []
    let reset = false
    let hint = 0
    let i = 0

    // Read the values of each group and check whether any of them decreased
    while (i < samples.length) {
      let group = previousOrder[hint]

      if (group !== undefined && group.epoch !== epoch && this.#readGroup(group, samples, i)) {
        hint++
      } else {
        group = this.#resolveGroup(family, samples, i, epoch)

        if (group.reset) {
          reset = true
          group.reset = false
        }

        if (group.position >= 0) {
          hint = group.position + 1
        }
      }

      const { values, next, layout } = group

      for (let j = 0; j < layout.length; j++) {
        if (next[j] < values[j] && j !== layout.sumIndex) {
          reset = true
        }
      }

      group.epoch = epoch
      group.position = order.length
      order.push(group)
      i += layout.length
    }

    // A label set which is no longer reported means that the metric has been reset
    if (order.length !== previousOrder.length || family.groups.size !== order.length) {
      for (const [key, group] of family.groups) {
        if (group.epoch !== epoch) {
          reset = true
          family.groups.delete(key)
        }
      }
    }

    // After a reset, the previous values of the worker are never subtracted, so they are carried forward
    for (const group of order) {
      const { values, next, indexes, total: totalGroup } = group
      const totals = totalGroup.values

      for (let j = 0; j < next.length; j++) {
        totals[indexes === null ? j : indexes[j]] += reset ? next[j] : next[j] - values[j]
      }

      group.values = next
      group.next = values
    }

    family.order = order
  }

  // Reads the values of a group from the samples starting at the given position.
  // Returns false if the samples do not have the same labels and layout of the group.
  #readGroup (group, samples, start) {
    const { layout, next } = group
    const end = start + layout.length

    if (
      end > samples.length ||
      !this.#hasGroupLabels(group, samples[start].labels) ||
      (layout.length > 1 && !this.#hasGroupLabels(group, samples[end - 1].labels))
    ) {
      return false
    }

    for (let j = 0; j < layout.length; j++) {
      const sample = samples[start + j]

      if (sample.metricName !== layout.metricNames[j] || sample.labels[kBucketLabel] !== layout.buckets[j]) {
        return false
      }

      next[j] = sample.value
    }

    return true
  }

  // Checks if the labels of a sample, ignoring the worker and bucket labels, are the labels of the group
  #hasGroupLabels (group, labels) {
    const groupLabels = group.labels
    let count = 0

    for (const name in labels) {
      if (name === kBucketLabel || name === this.#workerLabel) {
        continue
      }

      if (groupLabels[name] !== labels[name]) {
        return false
      }

      count++
    }

    return count === group.labelsCount
  }

  // Finds the group for the samples starting at the given position, creating it if needed
  #resolveGroup (family, samples, start, epoch) {
    const { total } = family
    const labels = removeLabels(samples[start].labels, this.#workerLabel, kBucketLabel)
    const labelsCount = Object.keys(labels).length
    const labelsKey = getCachedLabelsKey(total, undefined, labels, labelsCount)

    // The same label set reported more than once is tracked as a separate group, merged in the totals
    let key = labelsKey
    let existing = family.groups.get(key)
    for (let duplicate = 1; existing !== undefined && existing.epoch === epoch; duplicate++) {
      key = labelsKey + kDuplicateSeparator + duplicate
      existing = family.groups.get(key)
    }

    // The label set has moved, but it is otherwise unchanged
    if (existing !== undefined && matchesLayout(existing.layout, samples, start) && this.#readGroup(existing, samples, start)) {
      return existing
    }

    const layout = this.#getLayout(total, samples, start)
    const group = {
      labels,
      labelsCount,
      layout,
      values: new Float64Array(layout.length),
      next: new Float64Array(layout.length),
      total: null,
      indexes: null,
      epoch: 0,
      position: -1,
      // A label set whose samples changed means that the metric has been recreated
      reset: existing !== undefined
    }

    // Duplicates are merged into the same group of the totals
    this.#linkTotalGroup(group, total, labelsKey)
    family.groups.set(key, group)
    this.#readGroup(group, samples, start)
    return group
  }

  // Returns the layout of the samples starting at the given position, reusing the known ones
  #getLayout (total, samples, start) {
    for (const layout of total.layouts) {
      if (matchesLayout(layout, samples, start)) {
        return layout
      }
    }

    const first = samples[start]
    const metricNames = [first.metricName]
    const buckets = [first.labels[kBucketLabel]]

    for (let i = start + 1; i < samples.length && continuesGroup(first.labels, metricNames, buckets, samples[i]); i++) {
      metricNames.push(samples[i].metricName)
      buckets.push(samples[i].labels[kBucketLabel])
    }

    return createLayout(total, metricNames, buckets)
  }

  // Links the group of a worker to the group of the totals with the same labels,
  // finding the position of each sample in it
  #linkTotalGroup (group, total, key) {
    const { labels, layout } = group
    let totalGroup = total.groups.get(key)

    if (totalGroup === undefined) {
      totalGroup = { labels, layout, values: new Float64Array(layout.length), outputLabels: null }
      total.groups.set(key, totalGroup)
    }

    group.total = totalGroup

    if (totalGroup.layout === layout) {
      group.indexes = null
      return
    }

    // The workers report different samples for the same label set: add the missing ones to the totals
    const indexes = new Int32Array(layout.length)

    for (let i = 0; i < layout.length; i++) {
      let index = findSample(totalGroup.layout, layout.metricNames[i], layout.buckets[i])

      if (index === -1) {
        const { metricNames, buckets } = totalGroup.layout
        const values = new Float64Array(totalGroup.values.length + 1)
        values.set(totalGroup.values)

        index = metricNames.length
        totalGroup.layout = {
          metricNames: [...metricNames, layout.metricNames[i]],
          buckets: [...buckets, layout.buckets[i]],
          length: index + 1,
          sumIndex: totalGroup.layout.sumIndex
        }
        totalGroup.values = values
        totalGroup.outputLabels = null
      }

      indexes[i] = index
    }

    group.indexes = indexes
  }

  #groupValues (entry, metric) {
    for (const { metricName, labels, value } of metric.values) {
      const cleanLabels = removeLabels(labels, this.#workerLabel)
      const group = getOrCreate(entry.groups, getLabelsKey(metricName, cleanLabels), () => ({
        metricName,
        labels: cleanLabels,
        values: []
      }))

      group.values.push(value)
    }
  }

  #buildMetrics (output) {
    const metrics = []

    for (const applicationId of new Set([...output.keys(), ...this.#applications.keys()])) {
      const entries = output.get(applicationId)
      const totals = this.#applications.get(applicationId)?.families ?? new Map()
      const emitted = new Set()

      for (const entry of entries?.values() ?? []) {
        if (entry.mode === 'summary') {
          metrics.push(...entry.metrics)
        } else if (entry.mode === 'cumulative') {
          const family = totals.get(entry.name)

          if (family) {
            metrics.push(toMetric(family))
            emitted.add(entry.name)
          }
        } else {
          const metric = this.#mergeGroups(entry)

          if (metric) {
            metrics.push(metric)
          }
        }
      }

      // Cumulative metrics only reported by workers that are unavailable or gone
      for (const family of totals.values()) {
        if (!emitted.has(family.name)) {
          metrics.push(toMetric(family))
        }
      }
    }

    return metrics
  }

  #mergeGroups (entry) {
    if (entry.aggregator === 'omit') {
      return null
    }

    const aggregate = aggregators[entry.aggregator] ?? aggregators.sum
    const values = []

    for (const { metricName, labels, values: groupValues } of entry.groups.values()) {
      values.push(createValue(metricName, labels, aggregate(groupValues)))
    }

    return { name: entry.name, help: entry.help, type: entry.type, aggregator: entry.aggregator, values }
  }
}
