import { deepEqual } from 'node:assert'
import { test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { fetchStackables } from '../../lib/index.js'

const mockAgent = new MockAgent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10
})
mockAgent.disableNetConnect()

setGlobalDispatcher(mockAgent)

const MARKETPLACE_HOST = 'https://marketplace.platformatic.dev'

const mockPool = mockAgent.get(MARKETPLACE_HOST)
const defaultStackables = ['@platformatic/service', '@platformatic/composer', '@platformatic/db']

test('should fetch stackables from the marketplace', async () => {
  const mockStackables = [{ name: 'mock-service-1' }, { name: 'mock-service-2' }, { name: 'mock-service-3' }]

  mockPool.intercept({ path: '/templates' }).reply(200, mockStackables)

  const stackables = await fetchStackables()
  deepEqual(stackables, [...defaultStackables, ...mockStackables.map(s => s.name)])
})

test('add custom stackables', async () => {
  const mockStackables = [{ name: 'mock-service-1' }, { name: 'mock-service-2' }, { name: 'mock-service-3' }]

  mockPool.intercept({ path: '/templates' }).reply(200, mockStackables)

  const stackables = await fetchStackables(undefined, ['foo'])
  deepEqual(stackables, ['foo', ...defaultStackables, ...mockStackables.map(s => s.name)])
})

test('should return default stackables if fetching from the marketplace takes too long', async () => {
  mockPool.intercept({ path: '/templates' }).reply(200, async () => await setTimeout(6000, []))
  const stackables = await fetchStackables()
  deepEqual(stackables, defaultStackables)
})

test('should return default stackables if fetching from the marketplace errors', async () => {
  mockPool.intercept({ path: '/templates' }).replyWithError(new Error())
  const stackables = await fetchStackables()
  deepEqual(stackables, defaultStackables)
})
