'use strict'

const { test } = require('tap')
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
  t.equal(first, 'sampleOperationId')
  t.equal(second, 'getSampleOperationId')
  t.equal(third, 'getSampleOperationId1')
  t.equal(fourth, 'getSampleOperationId2')
})