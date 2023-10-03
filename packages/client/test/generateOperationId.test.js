'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { generateOperationId } = require('..')

test('generates name from different path with same method and opeartionId', async (t) => {
  const bucket = []
  const first = generateOperationId('sample-path', 'get', {
    operationId: 'sampleOperationId'
  }, bucket)

  const second = generateOperationId('sample-path2', 'get', {
    operationId: 'sampleOperationId'
  }, bucket)

  const third = generateOperationId('sample-path3', 'get', {
    operationId: 'sampleOperationId'
  }, bucket)

  const fourth = generateOperationId('sample-path4', 'get', {
    operationId: 'sampleOperationId'
  }, bucket)
  assert.equal(first, 'sampleOperationId')
  assert.equal(second, 'getSampleOperationId')
  assert.equal(third, 'getSampleOperationId1')
  assert.equal(fourth, 'getSampleOperationId2')
})
