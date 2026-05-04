import type { EventEmitter } from 'node:events'
import type { MessagePort } from 'node:worker_threads'
import { expect, test } from 'tstyche'
import {
  type Handler,
  initializeITCTelemetry,
  ITC,
  type ITCConstructorOptions,
  type OutgoingMessagingSpan,
  startOutgoingMessagingSpan,
  startOutgoingMessagingSpanSync,
  traceIncomingMessagingHandler
} from '../../lib/index.js'

declare const port: MessagePort

test('ITCConstructorOptions', () => {
  expect<ITCConstructorOptions>().type.toBeAssignableFrom({ port, name: 'worker' })
  expect<ITCConstructorOptions>().type.not.toBeAssignableFrom({})

  const syncHandler: Handler = (data) => {
    expect(data).type.toBe<any>()
  }
  const asyncHandler: Handler = (data) => Promise.resolve(
    expect(data).type.toBe<any>()
  )
  const handlers: Record<string, Handler> = { syncHandler, asyncHandler }

  expect<ITCConstructorOptions>().type.toBeAssignableFrom({ port, name: 'worker', handlers })
  expect<ITCConstructorOptions>().type.toBeAssignableFrom({ port, name: 'worker', throwOnMissingHandler: true })
})

test('ITC', () => {
  const itc = new ITC({ port, name: 'worker' })

  expect(itc).type.toBeAssignableTo<EventEmitter>()

  expect(itc.getHandler('message')).type.toBe<Handler | undefined>()

  expect(itc.send('message', { key: 'value' })).type.toBe<Promise<any>>()
  expect(itc.send('message', { key: 'value' }, { timeout: 1000 })).type.toBe<Promise<any>>()
  expect(itc.send).type.not.toBeCallableWith(123, { key: 'value' })

  expect(itc.notify('message', { key: 'value' })).type.toBe<void>()
  expect(itc.notify('message', { key: 'value' }, { timeout: 1000 })).type.toBe<void>()
  expect(itc.notify).type.not.toBeCallableWith(123, { key: 'value' })

  expect(itc.handle('message', () => ({ key: 'value' }))).type.toBe<void>()
  expect(itc.handle('message', async () => ({ key: 'value' }))).type.toBe<void>()
  expect(itc.handle).type.not.toBeCallableWith(123, () => ({ key: 'value' }))

  expect(itc.listen()).type.toBe<void>()
  expect(itc.close()).type.toBe<void>()
})

test('telemetry helpers', () => {
  expect(initializeITCTelemetry()).type.toBe<Promise<any>>()
  expect(startOutgoingMessagingSpan('send', 'source', 'target', 'message')).type.toBe<OutgoingMessagingSpan | null>()
  expect(startOutgoingMessagingSpanSync('send', 'source', 'target', 'message')).type.toBe<OutgoingMessagingSpan | null>()
  expect(traceIncomingMessagingHandler('target', 'message', () => null, null)).type.toBe<any>()
})
