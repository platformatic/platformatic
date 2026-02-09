import { strictEqual, ok } from 'node:assert'
import test from 'node:test'
import { ensureLoggableError, ensureError } from '../index.js'

test('ensureLoggableError - should make message enumerable', () => {
  const error = new Error('test message')
  const originalDescriptor = Object.getOwnPropertyDescriptor(error, 'message')
  strictEqual(originalDescriptor.enumerable, false)

  const result = ensureLoggableError(error)
  const newDescriptor = Object.getOwnPropertyDescriptor(result, 'message')
  strictEqual(newDescriptor.enumerable, true)
  strictEqual(result, error) // Should return the same object
})

test('ensureLoggableError - should make code enumerable when present', () => {
  const error = new Error('test message')
  error.code = 'TEST_CODE'
  const originalCodeDescriptor = Object.getOwnPropertyDescriptor(error, 'code')
  strictEqual(originalCodeDescriptor.enumerable, true) // code is enumerable by default when set

  const result = ensureLoggableError(error)
  const newCodeDescriptor = Object.getOwnPropertyDescriptor(result, 'code')
  strictEqual(newCodeDescriptor.enumerable, true)
})

test('ensureLoggableError - should make stack enumerable when present', () => {
  const error = new Error('test message')
  const originalStackDescriptor = Object.getOwnPropertyDescriptor(error, 'stack')
  strictEqual(originalStackDescriptor.enumerable, false)

  const result = ensureLoggableError(error)
  const newStackDescriptor = Object.getOwnPropertyDescriptor(result, 'stack')
  strictEqual(newStackDescriptor.enumerable, true)
})

test('ensureLoggableError - should handle error without code property', () => {
  const error = new Error('test message')
  delete error.code // Ensure no code property

  const result = ensureLoggableError(error)
  const messageDescriptor = Object.getOwnPropertyDescriptor(result, 'message')
  const stackDescriptor = Object.getOwnPropertyDescriptor(result, 'stack')

  strictEqual(messageDescriptor.enumerable, true)
  strictEqual(stackDescriptor.enumerable, true)
  strictEqual('code' in result, false)
})

test('ensureLoggableError - should handle error without stack property', () => {
  const error = new Error('test message')
  delete error.stack // Remove stack property

  const result = ensureLoggableError(error)
  const messageDescriptor = Object.getOwnPropertyDescriptor(result, 'message')

  strictEqual(messageDescriptor.enumerable, true)
  strictEqual('stack' in result, false)
})

test('ensureError - should return Error instance unchanged', () => {
  const error = new Error('test message')
  error.code = 'TEST_CODE'

  const result = ensureError(error)
  strictEqual(result, error)
  ok(result instanceof Error)
})

test('ensureError - should convert plain object to Error', () => {
  const errorLike = {
    message: 'test message',
    code: 'TEST_CODE',
    statusCode: 500
  }

  const result = ensureError(errorLike)
  ok(result instanceof Error)
  strictEqual(result.message, 'test message')
  strictEqual(result.code, 'TEST_CODE')
  strictEqual(result.statusCode, 500)
})

test('ensureError - should handle object without message property', () => {
  const errorLike = {
    code: 'TEST_CODE',
    statusCode: 500
  }

  const result = ensureError(errorLike)
  ok(result instanceof Error)
  strictEqual(result.message, '')
  strictEqual(result.code, 'TEST_CODE')
  strictEqual(result.statusCode, 500)
})

test('ensureError - should preserve all properties from error-like object', () => {
  const errorLike = {
    message: 'custom error',
    code: 'CUSTOM_CODE',
    statusCode: 400,
    details: { field: 'validation failed' },
    nested: { prop: 'value' }
  }

  const result = ensureError(errorLike)
  ok(result instanceof Error)
  strictEqual(result.message, 'custom error')
  strictEqual(result.code, 'CUSTOM_CODE')
  strictEqual(result.statusCode, 400)
  strictEqual(result.details.field, 'validation failed')
  strictEqual(result.nested.prop, 'value')
})
