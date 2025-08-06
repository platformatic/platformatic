import { equal } from 'node:assert'
import test from 'node:test'
import { getPrivateSymbol, isKeyEnabled, deepmerge } from '../index.js'

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

test('deepmerge - should merge objects recursively', () => {
  const obj1 = {
    a: 1,
    b: {
      c: 2
    }
  }

  const obj2 = {
    a: 3,
    b: {
      d: 4
    }
  }

  const result = deepmerge(obj1, obj2)
  equal(result.a, 3)
  equal(result.b.c, 2)
  equal(result.b.d, 4)
})

test('deepmerge - should merge arrays recursively', () => {
  const obj1 = {
    arr: [{ a: 1 }, { b: 2 }]
  }

  const obj2 = {
    arr: [{ a: 3 }]
  }

  const result = deepmerge(obj1, obj2)
  equal(result.arr.length, 2)
  equal(result.arr[0].a, 3)
  equal(result.arr[1].b, 2)
})

test('deepmerge - should handle arrays where source is shorter than target', () => {
  const obj1 = {
    arr: [{ a: 1 }, { b: 2 }, { c: 3 }]
  }

  const obj2 = {
    arr: [{ a: 4 }]
  }

  const result = deepmerge(obj1, obj2)
  equal(result.arr.length, 3)
  equal(result.arr[0].a, 4)
  equal(result.arr[1].b, 2)
  equal(result.arr[2].c, 3)
})
