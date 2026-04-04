import { expect, test } from 'tstyche'
import type { Configuration } from '@platformatic/foundation'
import { create, loadConfiguration, type Runtime, type RuntimeConfiguration, } from '../../index.js'

const context = {} as Configuration

test('create', () => {
  expect(create('.')).type.toBe<Promise<Runtime>>()

  expect(create('.', './config.json')).type.toBe<Promise<Runtime>>()
  expect(create('.', { baseUrl: 'http://localhost:3000' })).type.toBe<Promise<Runtime>>()

  expect(create('.', './config.json', context)).type.toBe<Promise<Runtime>>()
})

test('loadConfiguration', () => {
  expect(loadConfiguration('.')).type.toBe<Promise<RuntimeConfiguration>>()
  expect(loadConfiguration({ baseUrl: 'http://localhost:3000' })).type.toBe<Promise<RuntimeConfiguration>>()

  expect(loadConfiguration('.', './config.json')).type.toBe<Promise<RuntimeConfiguration>>()
  expect(loadConfiguration('.', { baseUrl: 'http://localhost:3000' })).type.toBe<Promise<RuntimeConfiguration>>()

  expect(loadConfiguration('.', './config.json', context)).type.toBe<Promise<RuntimeConfiguration>>()
  expect(loadConfiguration({ baseUrl: 'http://localhost:3000' }, './config.json', context)).type.toBe<Promise<RuntimeConfiguration>>()
})
