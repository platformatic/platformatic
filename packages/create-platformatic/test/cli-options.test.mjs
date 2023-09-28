'use strict'

import { test } from 'tap'
import { getRunPackageManagerInstall, getUseTypescript, getPort } from '../src/cli-options.mjs'

test('getRunPackageManagerInstall', async ({ same }) => {
  same(
    getRunPackageManagerInstall('npm'),
    {
      type: 'list',
      name: 'runPackageManagerInstall',
      message: 'Do you want to run npm install?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    }
  )
})

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
