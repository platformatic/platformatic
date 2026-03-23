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

test("PlatformaticGlobal", () => {
  const platformatic = getGlobal()
  expect(platformatic).type.toBe<PlatformaticGlobal | undefined>()

  // Runtime
  expect(platformatic!.isBuilding).type.toBe<boolean>()
  expect(platformatic!.executable).type.toBe<string>()

  // Service configuration
  expect(platformatic!.host).type.toBe<string>()
  expect(platformatic!.port).type.toBe<number>()
  expect(platformatic!.config).type.toBe<object>()
  expect(platformatic!.applicationId).type.toBe<string>()
  expect(platformatic!.workerId).type.toBe<number | string>()
  expect(platformatic!.root).type.toBe<string>()
  expect(platformatic!.isEntrypoint).type.toBe<boolean>()
  expect(platformatic!.basePath).type.toBe<string>()
  expect(platformatic!.runtimeBasePath).type.toBe<string>()
  expect(platformatic!.wantsAbsoluteUrls).type.toBe<boolean>()
  
  // Logging
  expect(platformatic!.logger).type.toBe<Pino.Logger>()
  expect(platformatic!.logLevel).type.toBe<Pino.Level>()
  expect(platformatic!.interceptLogging).type.toBe<boolean>()

  // Metrics
  expect(platformatic!.prometheus.client).type.toBe(Client)
  expect(platformatic!.prometheus.registry).type.toBe<Client.Registry>()
  expect(platformatic!.clientSpansAls).type.toBe<AsyncLocalStorage<unknown>>();
});
