'use strict'

import { test } from 'tap'
import { getUseTypescript, getPort } from '../src/cli-options.mjs'

test('getUseTypescript', async ({ same }) => {
  same(
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

test('getPort', async ({ same }) => {
  same(
    getPort(undefined),
    {
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?',
      default: 3042
    }
  )

  same(
    getPort(undefined),
    {
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?',
      default: 3043
    }
  )

  same(
    getPort(1234),
    {
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?',
      default: 1234
    }
  )

  same(
    getPort(undefined),
    {
      type: 'input',
      name: 'port',
      message: 'What port do you want to use?',
      default: 3044
    }
  )
})
