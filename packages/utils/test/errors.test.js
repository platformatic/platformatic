import { strictEqual } from 'node:assert'
import test from 'node:test'
import { ensureLoggableError } from '../index.js'

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
