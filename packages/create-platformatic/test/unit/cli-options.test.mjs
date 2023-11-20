'use strict'

import { test } from 'node:test'
import { deepEqual } from 'node:assert'
import { getUseTypescript, getPort } from '../../src/cli-options.mjs'

test('getUseTypescript', async () => {
  deepEqual(
    getUseTypescript(true),
    {
      type: 'list',
      when: false,
      name: 'useTypescript',
      message: 'Do you want to use TypeScript?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    }
  )
})

test('getPort', async () => {
  deepEqual(
    getPort(undefined),
    {
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?',
      default: 3042
    }
  )

  deepEqual(
    getPort(undefined),
    {
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?',
      default: 3043
    }
  )

  deepEqual(
    getPort(1234),
    {
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?',
      default: 1234
    }
  )

  deepEqual(
    getPort(undefined),
    {
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?',
      default: 3044
    }
  )
})
