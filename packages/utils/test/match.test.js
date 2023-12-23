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
