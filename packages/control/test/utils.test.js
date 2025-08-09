import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { getMatchingRuntime, RuntimeNotFound } from '../lib/index.js'

test('getMatchingRuntime - matches runtime by PID', async t => {
  const mockClient = {
    getRuntimes: async () => [
      { pid: 1234, packageName: 'app1', cwd: '/path/to/app1' },
      { pid: 5678, packageName: 'app2', cwd: '/path/to/app2' }
    ]
  }

  const [runtime, remainingPositionals] = await getMatchingRuntime(mockClient, ['1234', 'arg1', 'arg2'])

  strictEqual(runtime.pid, 1234)
  strictEqual(runtime.packageName, 'app1')
  deepStrictEqual(remainingPositionals, ['arg1', 'arg2'])
})

test('getMatchingRuntime - matches runtime by package name', async t => {
  const mockClient = {
    getRuntimes: async () => [
      { pid: 1234, packageName: 'app1', cwd: '/path/to/app1' },
      { pid: 5678, packageName: 'app2', cwd: '/path/to/app2' }
    ]
  }

  const [runtime, remainingPositionals] = await getMatchingRuntime(mockClient, ['app2', 'arg1'])

  strictEqual(runtime.pid, 5678)
  strictEqual(runtime.packageName, 'app2')
  deepStrictEqual(remainingPositionals, ['arg1'])
})

test('getMatchingRuntime - falls back to current working directory', async t => {
  const mockClient = {
    getRuntimes: async () => [
      { pid: 1234, packageName: 'app1', cwd: '/path/to/app1' },
      { pid: 5678, packageName: 'app2', cwd: process.cwd() }
    ]
  }

  const [runtime, remainingPositionals] = await getMatchingRuntime(mockClient, ['nonexistent'])

  strictEqual(runtime.pid, 5678)
  strictEqual(runtime.cwd, process.cwd())
  deepStrictEqual(remainingPositionals, ['nonexistent'])
})

test('getMatchingRuntime - no arguments, finds by current directory', async t => {
  const mockClient = {
    getRuntimes: async () => [
      { pid: 1234, packageName: 'app1', cwd: '/path/to/app1' },
      { pid: 5678, packageName: 'app2', cwd: process.cwd() }
    ]
  }

  const [runtime, remainingPositionals] = await getMatchingRuntime(mockClient, [])

  strictEqual(runtime.pid, 5678)
  strictEqual(runtime.cwd, process.cwd())
  deepStrictEqual(remainingPositionals, [])
})

test('getMatchingRuntime - throws RuntimeNotFound when no match', async t => {
  const mockClient = {
    getRuntimes: async () => [
      { pid: 1234, packageName: 'app1', cwd: '/path/to/app1' },
      { pid: 5678, packageName: 'app2', cwd: '/path/to/app2' }
    ]
  }

  await rejects(() => getMatchingRuntime(mockClient, ['nonexistent']), RuntimeNotFound)
})

test('getMatchingRuntime - throws RuntimeNotFound when no runtimes and no arguments', async t => {
  const mockClient = {
    getRuntimes: async () => []
  }

  await rejects(() => getMatchingRuntime(mockClient, []), RuntimeNotFound)
})

test('getMatchingRuntime - handles PID as string', async t => {
  const mockClient = {
    getRuntimes: async () => [{ pid: 1234, packageName: 'app1', cwd: '/path/to/app1' }]
  }

  const [runtime, remainingPositionals] = await getMatchingRuntime(mockClient, ['1234'])

  strictEqual(runtime.pid, 1234)
  deepStrictEqual(remainingPositionals, [])
})

test('getMatchingRuntime - handles non-numeric string as package name', async t => {
  const mockClient = {
    getRuntimes: async () => [{ pid: 1234, packageName: 'my-app', cwd: '/path/to/app' }]
  }

  const [runtime, remainingPositionals] = await getMatchingRuntime(mockClient, ['my-app'])

  strictEqual(runtime.packageName, 'my-app')
  deepStrictEqual(remainingPositionals, [])
})

test('getMatchingRuntime - PID match takes precedence over package name match', async t => {
  const mockClient = {
    getRuntimes: async () => [
      { pid: 123, packageName: 'app1', cwd: '/path/to/app1' },
      { pid: 456, packageName: '123', cwd: '/path/to/app2' }
    ]
  }

  const [runtime, remainingPositionals] = await getMatchingRuntime(mockClient, ['123'])

  strictEqual(runtime.pid, 123)
  strictEqual(runtime.packageName, 'app1')
  deepStrictEqual(remainingPositionals, [])
})

test('getMatchingRuntime - falls back to cwd when PID not found', async t => {
  const mockClient = {
    getRuntimes: async () => [{ pid: 456, packageName: 'my-app', cwd: process.cwd() }]
  }

  const [runtime, remainingPositionals] = await getMatchingRuntime(mockClient, ['123'])

  strictEqual(runtime.packageName, 'my-app')
  strictEqual(runtime.cwd, process.cwd())
  deepStrictEqual(remainingPositionals, ['123'])
})
