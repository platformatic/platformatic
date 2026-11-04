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

const kSeparator = '\u0000'
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

// The samples of cumulative metrics are organized in groups, one for each label set
// (ignoring the bucket label). A group contains all the samples of the label set:
// for histograms, these are the buckets, the sum and the count. Samples are identified
// by their metric name and bucket, and are usually found at the same position.
function createFamily ({ name, help, type, aggregator }) {
  return { name, help, type, aggregator, groups: new Map() }
}

function createGroup (labels) {
  return { labels, metricNames: [], buckets: [], values: [] }
}

function cloneGroup (group) {
  return {
    labels: group.labels,
    metricNames: group.metricNames.slice(),
    buckets: group.buckets.slice(),
    values: group.values.slice()
  }
}

function findSample (group, position, metricName, bucket) {
  const { metricNames, buckets } = group

  if (position < metricNames.length && metricNames[position] === metricName && buckets[position] === bucket) {
    return position
  }

  for (let i = 0; i < metricNames.length; i++) {
    if (metricNames[i] === metricName && buckets[i] === bucket) {
      return i
    }
  }

  return -1
}

function pushSample (group, metricName, bucket, value) {
  group.metricNames.push(metricName)
  group.buckets.push(bucket)
  group.values.push(value)
}

function addSample (group, position, metricName, bucket, value) {
  const index = findSample(group, position, metricName, bucket)

  if (index === -1) {
    pushSample(group, metricName, bucket, value)
  } else {
    group.values[index] += value
  }
}

function addFamily (target, source) {
  for (const [key, group] of source.groups) {
    const existing = target.groups.get(key)

    if (!existing) {
      target.groups.set(key, cloneGroup(group))
      continue
    }

    for (let i = 0; i < group.values.length; i++) {
      addSample(existing, i, group.metricNames[i], group.buckets[i], group.values[i])
    }
  }
}

// A cumulative sample which decreased or disappeared means that the worker
// has reset the metric, for instance because its registry was recreated.
function hasReset (previous, current) {
  // The sum of a histogram can legitimately decrease with negative observations
  const sumName = previous.type === 'histogram' ? `${previous.name}_sum` : null

  for (const [key, group] of previous.groups) {
    const currentGroup = current.groups.get(key)

    if (!currentGroup) {
      return true
    }

    for (let i = 0; i < group.values.length; i++) {
      const metricName = group.metricNames[i]

      if (sumName !== null && metricName === sumName) {
        continue
      }

      const index = findSample(currentGroup, i, metricName, group.buckets[i])

      if (index === -1 || currentGroup.values[index] < group.values[i]) {
        return true
      }
    }
  }

  return false
}

function createValue (metricName, labels, value) {
  const result = { value, labels }

  if (metricName !== undefined) {
    result.metricName = metricName
  }

  return result
}

function toMetric (family) {
  const values = []

  for (const { labels, metricNames, buckets, values: groupValues } of family.groups.values()) {
    for (let i = 0; i < groupValues.length; i++) {
      const bucket = buckets[i]
      values.push(
        createValue(metricNames[i], bucket === undefined ? { ...labels } : { le: bucket, ...labels }, groupValues[i])
      )
    }
  }

  return { name: family.name, help: family.help, type: family.type, aggregator: family.aggregator, values }
}

export class WorkerMetricsAggregator {
  #workerLabel
  #nonCumulativeMetrics
  // Last cumulative values reported by each worker: key -> { applicationId, families }
  #workers
  // Values carried forward from workers that exited or reset: applicationId -> families
  #carried

  constructor ({ workerLabel = 'workerId', nonCumulativeMetrics = [] } = {}) {
    this.#workerLabel = workerLabel
    this.#nonCumulativeMetrics = new Set(nonCumulativeMetrics)
    this.#workers = new Map()
    this.#carried = new Map()
  }

  // Each item in workers is { key, applicationId, metrics }, where key identifies the
  // worker instance and metrics is the output of getMetricsAsJSON(), or null if the worker
  // could not be queried. A tracked worker which is missing from the list is considered
  // gone. Carried values of applications not included in applicationIds are discarded.
  aggregate (workers, applicationIds) {
    const output = new Map()
    const queried = new Set()

    for (const { key, applicationId, metrics } of workers) {
      queried.add(key)

      // The worker is temporarily unavailable, its last cumulative values are still used
      if (!metrics) {
        continue
      }

      const worker = getOrCreate(this.#workers, key, () => ({ applicationId, families: new Map() }))
      const families = getOrCreate(output, applicationId, () => new Map())
      const reported = new Set()

      for (const metric of metrics) {
        const entry = getOrCreate(families, metric.name, () => this.#createEntry(metric))

        if (entry.mode === 'summary') {
          entry.metrics.push(metric)
        } else if (entry.mode === 'cumulative') {
          this.#trackCumulativeMetric(worker, metric)
          reported.add(metric.name)
        } else {
          this.#groupValues(entry, metric)
        }
      }

      // A metric which is no longer reported has been removed from the registry
      for (const [name, family] of worker.families) {
        if (!reported.has(name)) {
          this.#carry(worker.applicationId, family)
          worker.families.delete(name)
        }
      }
    }

    for (const [key, worker] of this.#workers) {
      if (!queried.has(key)) {
        for (const family of worker.families.values()) {
          this.#carry(worker.applicationId, family)
        }

        this.#workers.delete(key)
      }
    }

    for (const applicationId of this.#carried.keys()) {
      if (!applicationIds.has(applicationId)) {
        this.#carried.delete(applicationId)
      }
    }

    return this.#buildMetrics(output, this.#computeCumulativeTotals())
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

  #parseCumulativeMetric (metric) {
    const family = createFamily(metric)
    let group = null
    let groupLabels = null
    let isNewGroup = false

    // Samples of the same label set are consecutive, so the group key is only computed once for each of them
    for (const { metricName, labels, value } of metric.values) {
      if (group === null || !hasSameLabels(groupLabels, labels)) {
        const cleanLabels = removeLabels(labels, this.#workerLabel, kBucketLabel)
        const key = getLabelsKey(undefined, cleanLabels)

        group = family.groups.get(key)
        isNewGroup = group === undefined
        groupLabels = labels

        if (isNewGroup) {
          group = createGroup(cleanLabels)
          family.groups.set(key, group)
        }
      }

      if (isNewGroup) {
        pushSample(group, metricName, labels[kBucketLabel], value)
      } else {
        addSample(group, group.values.length, metricName, labels[kBucketLabel], value)
      }
    }

    return family
  }

  #trackCumulativeMetric (worker, metric) {
    const family = this.#parseCumulativeMetric(metric)
    const previous = worker.families.get(metric.name)

    if (previous && hasReset(previous, family)) {
      this.#carry(worker.applicationId, previous)
    }

    worker.families.set(metric.name, family)
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

  #carry (applicationId, family) {
    const families = getOrCreate(this.#carried, applicationId, () => new Map())
    addFamily(
      getOrCreate(families, family.name, () => createFamily(family)),
      family
    )
  }

  // Sums the last values of every tracked worker and the carried values
  #computeCumulativeTotals () {
    const totals = new Map()

    for (const { applicationId, families } of this.#workers.values()) {
      const applicationTotals = getOrCreate(totals, applicationId, () => new Map())

      for (const family of families.values()) {
        addFamily(getOrCreate(applicationTotals, family.name, () => createFamily(family)), family)
      }
    }

    for (const [applicationId, families] of this.#carried) {
      const applicationTotals = getOrCreate(totals, applicationId, () => new Map())

      for (const family of families.values()) {
        addFamily(getOrCreate(applicationTotals, family.name, () => createFamily(family)), family)
      }
    }

    return totals
  }

  #buildMetrics (output, totals) {
    const metrics = []

    for (const applicationId of new Set([...output.keys(), ...totals.keys()])) {
      const families = output.get(applicationId)
      const applicationTotals = totals.get(applicationId) ?? new Map()

      for (const entry of families?.values() ?? []) {
        if (entry.mode === 'summary') {
          metrics.push(...entry.metrics)
        } else if (entry.mode === 'cumulative') {
          const family = applicationTotals.get(entry.name)

          if (family) {
            metrics.push(toMetric(family))
            applicationTotals.delete(entry.name)
          }
        } else {
          const metric = this.#mergeGroups(entry)

          if (metric) {
            metrics.push(metric)
          }
        }
      }

      // Cumulative metrics only reported by workers that are unavailable or gone
      for (const family of applicationTotals.values()) {
        metrics.push(toMetric(family))
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
