'use strict'

// Experiment only. Retain the production reservation lifecycle unchanged.
exports.install = function install (routing, symbols, mode) {
  const original = routing.select
  if (!['tie', 'bounded'].includes(mode)) return
  routing.select = function select (pool, hostname) {
    if (!pool?.ports.some(port => port[routing.kRouting])) return original(pool, hostname)
    const start = pool.index++ % Math.max(1, pool.ports.length)
    const candidates = []
    for (let i = 0; i < pool.ports.length; i++) {
      const port = pool.ports[(start + i) % pool.ports.length]
      const state = port[routing.kRouting]
      if (!port[symbols.kReady] || port[symbols.kAddress] || !state) continue
      const snapshot = routing.snapshot(state)
      if (!snapshot.ready) continue
      const age = ((Date.now() & 0x7fffffff) - snapshot.sampledAt) & 0x7fffffff
      candidates.push({ port, state, load: snapshot.outstanding, elu: age <= 300 && snapshot.elu !== null ? snapshot.elu : null })
    }
    // Unknown/stale ELU cannot be ranked as either healthy or unhealthy.
    // Fall back to least outstanding unless all candidates have fresh samples.
    const fresh = candidates.length && candidates.every(candidate => candidate.elu !== null)
    const minimum = Math.min(...candidates.map(candidate => candidate.load))
    const allowance = mode === 'bounded' ? 1 : 0
    candidates.sort((a, b) => {
      if (!fresh) return a.load - b.load
      const aNear = a.load <= minimum + allowance
      const bNear = b.load <= minimum + allowance
      if (aNear !== bNear) return aNear ? -1 : 1
      // Ten-percentage-point bands avoid acting on tiny utilization differences.
      if (aNear) return Math.floor(a.elu * 10) - Math.floor(b.elu * 10) || a.load - b.load
      return a.load - b.load
    })
    for (const { port, state } of candidates) {
      const reservation = routing.reserve(state)
      if (reservation) return { port, reservation }
    }
    // Delegate failure accounting and the documented HTTP rejection semantics.
    return original(pool, hostname)
  }
}
