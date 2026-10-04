// Diagnostic, not a capacity result. Compare selector costs in isolation.
import { performance } from 'node:perf_hooks'
import routing from '../../packages/runtime/lib/mesh/lib/request-routing.js'
import utils from '../../packages/runtime/lib/mesh/lib/utils.js'
import roundrobin from '../../packages/runtime/lib/mesh/lib/roundrobin.js'
const results = []
for (const maxOutstanding of [32, 64, 128, 4096]) {
  const rr = new roundrobin.RoundRobin()
  for (let i = 0; i < 4; i++) {
    const state = routing.createState({ maxOutstanding }); routing.setReady(state, true)
    rr.add({ [utils.kReady]: true, [routing.kRouting]: state })
  }
  for (let i = 0; i < 20000; i++) routing.release(routing.select(rr, 'app').reservation)
  const count = 200000, start = performance.now()
  for (let i = 0; i < count; i++) routing.release(routing.select(rr, 'app').reservation)
  results.push({ maxOutstanding, iterations: count, nsPerSelectRelease: (performance.now() - start) * 1e6 / count })
}
console.log(JSON.stringify(results, null, 2))
