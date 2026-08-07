import type { Configuration } from '@platformatic/foundation'
import type { JSONSchemaType } from 'ajv'
import { expect, test } from 'tstyche'
import schedulerModule from '@platformatic/nuxt/scheduler'
import {
  NuxtCapability,
  type PlatformaticNuxtConfig,
  create,
  loadConfiguration,
  packageJson,
  schema,
  schemaComponents,
  supportedVersions,
  version
} from '../../index.js'

test('Nuxt types', () => {
  const config = {} as PlatformaticNuxtConfig

  expect(loadConfiguration('/tmp', config)).type.toBe<Promise<Configuration<PlatformaticNuxtConfig>>>()
  expect(create('/tmp', config)).type.toBe<Promise<NuxtCapability>>()
  expect(create(config)).type.toBe<Promise<NuxtCapability>>()

  expect(loadConfiguration).type.toBeCallableWith('/tmp', config)
  expect(create).type.toBeCallableWith('/tmp', config)

  expect(loadConfiguration('/tmp', config, {} as Parameters<typeof loadConfiguration>[2])).type.toBe<Promise<Configuration<PlatformaticNuxtConfig>>>()

  expect(schema).type.toBe<JSONSchemaType<PlatformaticNuxtConfig>>()
  expect(schemaComponents).type.toBe<{ nuxt: unknown }>()
  expect(packageJson).type.toBe<Record<string, unknown>>()
  expect(version).type.toBe<string>()
  expect(supportedVersions).type.toBe<string>()
  const capability = new NuxtCapability('/tmp', config)
  expect(capability).type.toBe<NuxtCapability>()
  expect(capability.getScheduledTasks()).type.toBe<Promise<Array<{ id: string; cron: string; tasks: string[] }>>>()
  expect(capability.runScheduledTasks('0', Date.now())).type.toBe<Promise<unknown>>()
  expect(schedulerModule).type.toBeCallableWith({}, { hook () {} })
})
