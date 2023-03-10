import { test } from 'tap'
import { getRunPackageManagerInstall, getUseTypescript } from '../src/cli-options.mjs'

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
