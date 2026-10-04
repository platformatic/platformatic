import { test } from 'node:test'
import { strictEqual, throws, ok } from 'node:assert'
import { MessageChannel, Worker } from 'node:worker_threads'
import routing from '../lib/mesh/lib/request-routing.js'
import utils from '../lib/mesh/lib/utils.js'
import roundrobin from '../lib/mesh/lib/roundrobin.js'
import stores from '../lib/mesh/lib/requests-store.js'
import common from '../lib/mesh/lib/common.js'
import interceptor from '../lib/mesh/lib/interceptor.js'

function setup (t, options = {}) {
  const state = routing.createState({ maxOutstanding: 2 }); routing.setReady(state, true)
  const { port1, port2 } = new MessageChannel()
  t.after(() => { port1.close(); port2.close() })
  port1[utils.kReady] = true; port1[routing.kRouting] = state
  port1[utils.kInflightOutgoing] = new stores.RequestsStore()
  const rr = new roundrobin.RoundRobin(); rr.add(port1)
  const mesh = interceptor.createInterceptor({ domain: '.local', requestRoutingApplications: ['alpha'], ...options })
  mesh[utils.kRoutes].set('alpha.local', rr)
  return { state, port1, port2, mesh, dispatch: mesh(() => { throw Error('Unexpected network fallback') }) }
}
const opts = { origin: 'http://alpha.local', path: '/', method: 'GET' }

test('construction and client hook errors release unsent reservations', t => {
  const { state, dispatch } = setup(t, { onClientRequest () { throw Error('Hook failed') } })
  throws(() => dispatch(opts, { onRequestStart () {} }), /Hook failed/)
  strictEqual(routing.snapshot(state).outstanding, 0)
  strictEqual(routing.snapshot(state).selected, 1)
  strictEqual(routing.snapshot(state).completed, 1)
})

test('a request aborted before transport dispatch never consumes backend capacity', t => {
  const { state, dispatch } = setup(t)
  throws(() => dispatch(opts, { onRequestStart (controller) { controller.abort(Error('Cancelled')) } }), /Cancelled/)
  strictEqual(routing.snapshot(state).outstanding, 0)
})

test('structured-clone failure removes outgoing callbacks and releases capacity', t => {
  const { state, port1, dispatch } = setup(t)
  throws(() => dispatch({ ...opts, nonSerializable: () => {} }, { onRequestStart () {} }), { name: 'DataCloneError' })
  strictEqual(port1[utils.kInflightOutgoing].size, 0)
  strictEqual(routing.snapshot(state).outstanding, 0)
})

test('timeout cancels the caller once while retaining accepted backend work', async t => {
  const { state, port1, port2, dispatch } = setup(t, { timeout: 40 })
  let errors = 0
  const error = new Promise(resolve => {
    dispatch(opts, { onRequestStart () {}, onResponseError (controller, err) { errors++; resolve(err) } })
  })
  const message = await new Promise(resolve => port2.once('message', resolve))
  strictEqual(routing.accept(message.reservation, state), true)
  ok((await error).message.includes('Timeout'))
  strictEqual(errors, 1); strictEqual(port1[utils.kInflightOutgoing].size, 0)
  strictEqual(routing.snapshot(state).outstanding, 1)
  strictEqual(routing.release(message.reservation), true)
  strictEqual(routing.snapshot(state).outstanding, 0)
})

test('bitmap word boundaries preserve finite admission at all supported sizes', () => {
  for (const maxOutstanding of [1, 31, 32, 33, 128, 4096]) {
    const state = routing.createState({ maxOutstanding }); routing.setReady(state, true)
    const reservations = Array.from({ length: maxOutstanding }, () => routing.reserve(state))
    ok(reservations.every(Boolean)); strictEqual(routing.snapshot(state).outstanding, maxOutstanding)
    strictEqual(routing.reserve(state), null)
    for (const reservation of reservations) strictEqual(routing.release(reservation), true)
    strictEqual(routing.snapshot(state).outstanding, 0)
  }
})

test('configured applications without a live route return predictable unavailability', t => {
  const { port1, dispatch } = setup(t, { requestRoutingApplications: ['alpha'] })
  delete port1[routing.kRouting]
  let status, body
  dispatch(opts, {
    onRequestStart () {},
    onResponseStart (controller, code) { status = code },
    onResponseData (controller, data) { body = JSON.parse(data) },
    onResponseEnd () {}
  })
  strictEqual(status, 503); strictEqual(body.code, 'PLT_REQUEST_CAPACITY_EXCEEDED')
})

test('a closing caller cannot publish new reservations to closed channels', t => {
  const { state, mesh, dispatch } = setup(t)
  mesh[utils.kClosed] = true
  throws(() => dispatch(opts, { onRequestStart () {} }), /dispatcher has been closed/)
  strictEqual(routing.snapshot(state).outstanding, 0)
  strictEqual(routing.snapshot(state).selected, 0)
})

test('mesh acknowledgements do not wait on an already-exited real worker', async () => {
  const worker = new Worker('', { eval: true })
  await new Promise(resolve => worker.once('exit', resolve))
  strictEqual(worker.threadId, -1)
  strictEqual(await utils.waitMessage(worker, { timeout: 50 }, () => true), null)
})

test('publishing a routed worker enables existing round-robin callers and preserves unavailability', t => {
  const { state, port1, mesh, dispatch } = setup(t, { requestRoutingApplications: [] })
  port1[utils.kThread] = 123
  common.updateRoute(mesh, 'alpha.local', 123, true, null, state)
  dispatch(opts, { onRequestStart () {} })
  strictEqual(routing.snapshot(state).selected, 1)
  mesh[utils.kRoutes].delete('alpha.local')
  let status
  dispatch(opts, { onRequestStart () {}, onResponseStart (controller, code) { status = code }, onResponseData () {}, onResponseEnd () {} })
  strictEqual(status, 503)
})

test('the round-robin fast path still refuses dispatch after caller close', t => {
  const { mesh, dispatch } = setup(t, { requestRoutingApplications: [] })
  mesh[utils.kClosed] = true
  throws(() => dispatch(opts, { onRequestStart () {} }), /dispatcher has been closed/)
})


test('target channel exit settles callers and an already-pending route drain', async t => {
  const { state, port1, port2, mesh, dispatch } = setup(t)
  mesh[utils.kRoutes].clear()
  port1[utils.kThread] = 123
  common.addRoute(mesh, 'alpha.local', port1, () => {})
  let errors = 0
  dispatch(opts, { onRequestStart () {}, onResponseError () { errors++ } })
  const message = await new Promise(resolve => port2.once('message', resolve))
  strictEqual(routing.accept(message.reservation, state), true)
  const drained = common.removeRoute(mesh, 123)
  const closed = new Promise(resolve => port1.once('close', resolve))
  port2.close()
  await closed
  const settled = await Promise.race([drained.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 100))])
  strictEqual(settled, true)
  strictEqual(port1[utils.kInflightOutgoing].size, 0)
  strictEqual(errors, 1)
  strictEqual(routing.snapshot(state).outstanding, 1)
  routing.release(message.reservation)
  strictEqual(routing.snapshot(state).outstanding, 0)
})
