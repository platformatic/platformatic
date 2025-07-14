import { equal, throws } from 'node:assert'
import test from 'node:test'
import { checkNodeVersionForServices, features } from '../index.js'

test('checkNodeVersionForServices - should pass for current Node.js version', () => {
  // Since we're running on a supported Node.js version, this should not throw
  checkNodeVersionForServices()
})

test('checkNodeVersionForServices - should throw for old Node.js version', t => {
  // Mock process.version to simulate an old version
  const originalVersion = process.version
  Object.defineProperty(process, 'version', {
    value: 'v18.0.0',
    configurable: true
  })

  t.after(() => {
    Object.defineProperty(process, 'version', {
      value: originalVersion,
      configurable: true
    })
  })

  throws(() => checkNodeVersionForServices(), {
    name: 'Error',
    message:
      /Your current Node\.js version is v18\.0\.0, while the minimum supported version is v22\.16\.0\. Please upgrade Node\.js and try again\./
  })
})

test('features - should have node features object', () => {
  equal(typeof features.node.reusePort, 'boolean')
  equal(typeof features.node.worker.getHeapStatistics, 'boolean')
})

test('features - node.reusePort should be boolean', () => {
  equal(typeof features.node.reusePort, 'boolean')
})

test('features - node.worker.getHeapStatistics should be boolean', () => {
  equal(typeof features.node.worker.getHeapStatistics, 'boolean')
})
