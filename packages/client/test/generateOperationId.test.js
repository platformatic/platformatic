import { equal } from 'node:assert/strict'
import { test } from 'node:test'
import { generateOperationId } from '../index.js'

test('generates name from different path with same method and opeartionId', async t => {
  const bucket = []
  const first = generateOperationId(
    'sample-path',
    'get',
    {
      operationId: 'sampleOperationId'
    },
    bucket
  )

  const second = generateOperationId(
    'sample-path2',
    'get',
    {
      operationId: 'sampleOperationId'
    },
    bucket
  )

  const third = generateOperationId(
    'sample-path3',
    'get',
    {
      operationId: 'sampleOperationId'
    },
    bucket
  )

  const fourth = generateOperationId(
    'sample-path4',
    'get',
    {
      operationId: 'sampleOperationId'
    },
    bucket
  )
  equal(first, 'sampleOperationId')
  equal(second, 'getSampleOperationId')
  equal(third, 'getSampleOperationId1')
  equal(fourth, 'getSampleOperationId2')
})

test('generates name with path parameter', async t => {
  const opId = generateOperationId('/v3/accounts/{id}', 'get', {}, [])
  equal(opId, 'getV3AccountsId')
})

test('sanitizies bad operationId fields', async t => {
  const opId = generateOperationId(
    '/v3/accounts/{id}',
    'get',
    {
      operationId: '/v3/accounts/{id}'
    },
    []
  )

  equal(opId, 'getV3AccountsId')
})
