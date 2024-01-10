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

test('generates name with path parameter', async (t) => {
  const opId = generateOperationId('/v3/accounts/{id}', 'get', {}, [])

  assert.equal(opId, 'getV3AccountsId')
})

test('sanitizies bad operationId fields', async (t) => {
  const opId = generateOperationId('/v3/accounts/{id}', 'get', {
    operationId: '/v3/accounts/{id}'
  }, [])

  assert.equal(opId, 'getV3AccountsId')
})
