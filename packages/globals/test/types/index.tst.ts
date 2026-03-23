import type { AsyncLocalStorage } from 'node:async_hooks'
import * as Client from '@platformatic/prom-client'
import type Pino from 'pino'
import { expect, test } from 'tstyche'
import { getGlobal, type PlatformaticGlobal } from '../../lib/index.js'

test("getGlobal", () => {
  expect(getGlobal()).type.toBe<PlatformaticGlobal | undefined>()
  expect(getGlobal<{ extra: boolean }>()).type.toBe<(PlatformaticGlobal & { extra: boolean }) | undefined>()

  expect(getGlobal).type.toBeCallableWith()
  expect(getGlobal).type.not.toBeCallableWith({})
})

test("PlatformaticGlobalInterface", () => {
  const global = getGlobal()
  expect(global).type.toBe<PlatformaticGlobal | undefined>()

  // Runtime
  expect(global!.isBuilding).type.toBe<boolean>()
  expect(global!.executable).type.toBe<string>()

  // Service configuration
  expect(global!.host).type.toBe<string>()
  expect(global!.port).type.toBe<number>()
  expect(global!.config).type.toBe<object>()
  expect(global!.applicationId).type.toBe<string>()
  expect(global!.workerId).type.toBe<number | string>()
  expect(global!.root).type.toBe<string>()
  expect(global!.isEntrypoint).type.toBe<boolean>()
  expect(global!.basePath).type.toBe<string>()
  expect(global!.runtimeBasePath).type.toBe<string>()
  expect(global!.wantsAbsoluteUrls).type.toBe<boolean>()
  
  // Logging
  expect(global!.logger).type.toBe<Pino.Logger>()
  expect(global!.logLevel).type.toBe<Pino.Level>()
  expect(global!.interceptLogging).type.toBe<boolean>()

  // Metrics
  expect(global!.prometheus.client).type.toBe(Client)
  expect(global!.prometheus.registry).type.toBe<Client.Registry>()
  expect(global!.clientSpansAls).type.toBe<AsyncLocalStorage<unknown>>();
});
