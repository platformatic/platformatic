import { deepStrictEqual, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { RoundRobinMap } from '../lib/worker/round-robin-map.js'

test('worker enumeration preserves filtered round-robin selection', () => {
  const workers = new RoundRobinMap()
  const first = { id: 'app:0', ready: true }
  const second = { id: 'app:1', ready: false }
  const third = { id: 'app:2', ready: true }
  workers.set(first.id, first)
  workers.set(second.id, second)
  workers.set(third.id, third)
  workers.set('other:0', { id: 'other:0' })

  deepStrictEqual(workers.getApplications(), ['app', 'other'])
  deepStrictEqual(workers.getAll('app'), [first, second, third])
  deepStrictEqual(workers.getAll('missing'), [])

  const selected = Array.from({ length: 4 }, () => workers.next('app', worker => worker.ready))
  strictEqual(selected.includes(second), false)
  strictEqual(selected[0], selected[2])
  strictEqual(selected[1], selected[3])
  strictEqual(new Set(selected).size, 2)
  strictEqual(workers.next('app', () => false), undefined)

  workers.delete(first.id)
  workers.delete(third.id)
  deepStrictEqual(workers.getAll('app'), [second])
  strictEqual(workers.next('app'), second)
  workers.delete(second.id)
  deepStrictEqual(workers.getApplications(), ['other'])
  strictEqual(workers.next('app'), undefined)
})
