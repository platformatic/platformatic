import { equal } from 'node:assert'
import test from 'node:test'
import { getPrivateSymbol, isKeyEnabled } from '../index.js'

test('isKeyEnabled', async t => {
  const a = {
    foo: true,
    bar: {
      hello: 'world'
    },
    baz: false
  }
  equal(isKeyEnabled('foo', a), true)
  equal(isKeyEnabled('bar', a), true)
  equal(isKeyEnabled('baz', a), false)
  equal(isKeyEnabled('nope', a), false)
  equal(isKeyEnabled('something', undefined), false)
})

test('getPrivateSymbol - should find symbol by description', () => {
  const testSymbol = Symbol('testDescription')
  const otherSymbol = Symbol('otherDescription')
  const obj = {
    [testSymbol]: 'value1',
    [otherSymbol]: 'value2',
    regularProp: 'value3'
  }

  const foundSymbol = getPrivateSymbol(obj, 'testDescription')
  equal(foundSymbol, testSymbol)
})

test('getPrivateSymbol - should return undefined when symbol not found', () => {
  const testSymbol = Symbol('testDescription')
  const obj = {
    [testSymbol]: 'value1',
    regularProp: 'value2'
  }

  const foundSymbol = getPrivateSymbol(obj, 'nonExistentDescription')
  equal(foundSymbol, undefined)
})

test('getPrivateSymbol - should handle objects with no symbols', () => {
  const obj = {
    regularProp: 'value1',
    anotherProp: 'value2'
  }

  const foundSymbol = getPrivateSymbol(obj, 'anyDescription')
  equal(foundSymbol, undefined)
})
