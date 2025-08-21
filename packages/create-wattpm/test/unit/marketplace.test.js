import { deepEqual } from 'node:assert'
import { test } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { MockAgent, setGlobalDispatcher } from 'undici'
import { fetchCapabilities } from '../../lib/index.js'

const mockAgent = new MockAgent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10
})
mockAgent.disableNetConnect()

setGlobalDispatcher(mockAgent)

const MARKETPLACE_HOST = 'https://marketplace.platformatic.dev'

const mockPool = mockAgent.get(MARKETPLACE_HOST)
const defaultCapabilities = ['@platformatic/service', '@platformatic/composer', '@platformatic/db']

test('should fetch capabilities from the marketplace', async () => {
  const mockCapabilities = [
    { name: 'mock-application-1' },
    { name: 'mock-application-2' },
    { name: 'mock-application-3' }
  ]

  mockPool.intercept({ path: '/templates' }).reply(200, mockCapabilities)

  const capabilities = await fetchCapabilities()
  deepEqual(capabilities, [...defaultCapabilities, ...mockCapabilities.map(s => s.name)])
})

test('add custom capabilities', async () => {
  const mockCapabilities = [
    { name: 'mock-application-1' },
    { name: 'mock-application-2' },
    { name: 'mock-application-3' }
  ]

  mockPool.intercept({ path: '/templates' }).reply(200, mockCapabilities)

  const capabilities = await fetchCapabilities(undefined, ['foo'])
  deepEqual(capabilities, ['foo', ...defaultCapabilities, ...mockCapabilities.map(s => s.name)])
})

test('should return default capabilities if fetching from the marketplace takes too long', async () => {
  mockPool.intercept({ path: '/templates' }).reply(200, async () => await setTimeout(6000, []))
  const capabilities = await fetchCapabilities()
  deepEqual(capabilities, defaultCapabilities)
})

test('should return default capabilities if fetching from the marketplace errors', async () => {
  mockPool.intercept({ path: '/templates' }).replyWithError(new Error())
  const capabilities = await fetchCapabilities()
  deepEqual(capabilities, defaultCapabilities)
})
