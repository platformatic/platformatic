'use strict'

const { test } = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const { match } = require('..')

test('simple match', async (t) => {
  const { ok } = tspl(t, { plan: 1 })
  ok(match({ a: 1, b: 2 }, { a: 1 }))
})

test('complex match', async (t) => {
  const { ok } = tspl(t, { plan: 1 })
  ok(match({ a: 1, b: { c: 2 }, d: {} }, { a: 1, b: { c: 2 } }))
})

test('complex match with null', async (t) => {
  const { ok } = tspl(t, { plan: 1 })
  ok(match({ a: 1, b: { c: 2 }, d: null }, { a: 1, b: { c: 2 } }))
})

test('should not match', async (t) => {
  const { equal } = tspl(t, { plan: 1 })
  equal(match({ a: 1, b: 2 }, { a: 2 }), false)
})

test('should not match with null', async (t) => {
  const { equal } = tspl(t, { plan: 1 })
  equal(match({ a: 1, b: null }, { a: 2 }), false)
})

test('should not match with undefined', async (t) => {
  const { equal } = tspl(t, { plan: 1 })
  equal(match({ a: 1, b: undefined }, { a: 2 }), false)
})

test('should return false for non-existing key', (t) => {
  const { equal } = tspl(t, { plan: 1 })
  const actual = { a: 1, b: 2 }
  const expected = { a: 1, b: 2, c: 3 }
  equal(match(actual, expected), false)
})

test('should return false for mismatching values', (t) => {
  const { equal } = tspl(t, { plan: 1 })
  equal(match({ a: 1, b: 2 }, { a: 1, c: 3 }), false)
})

test('match arrays', (t) => {
  const { strictEqual } = tspl(t, { plan: 1 })
  strictEqual(match([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 2 }]), true)
})

test('do not match arrays', (t) => {
  const { strictEqual } = tspl(t, { plan: 1 })
  strictEqual(match([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 3 }]), false)
})

test('string pattern match fail', async (t) => {
  const { equal } = tspl(t, { plan: 1 })
  equal(match({ a: 'hello world', b: 2 }, { a: 'world.*' }), false)
})

test('multi-line string pattern match', async (t) => {
  const { ok } = tspl(t, { plan: 1 })
  const actual = `
    function example() {
      console.log('Hello, world!');
      return true;
    }
  `
  const expected = `
    console.log('Hello, world!');
    return true;
  `
  ok(match(actual, expected))
})

test('multi-line string pattern match fail', async (t) => {
  const { equal } = tspl(t, { plan: 1 })
  const actual = `
    function example() {
      console.log('Hello, world!');
      return false;
    }
  `
  const expected = `
    console.log('Goodbye, world!');
    return true;
  `
  equal(match(actual, expected), false)
})
