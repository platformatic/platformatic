import { execa } from 'execa'
import assert from 'node:assert/strict'
import { cp, readFile, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { cliPath } from './helper.js'

test('installs runtime external services', async t => {
  const dest = await mkdtemp(join(tmpdir(), `test-cli-${process.pid}-`))

  await cp(join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'runtime-install'), dest, {
    recursive: true,
  })

  const child = await execa('node', [cliPath, 'install', '--test'], { cwd: dest })

  assert.ok(child.stdout.includes(
    `Cloning http://github.com/test-owner/test-app-1.git into ${join('external', 'external-service-1')}`
  ))
  assert.ok(child.stdout.includes(
    `Cloning http://github.com/test-owner/test-app-2.git into ${join('custom-external', 'external-service-2')}`
  ))
  assert.ok(child.stdout.includes(
    `Cloning http://github.com/test-owner/test-app-3.git into ${join('external', 'external-service-3')}`
  ))

  assert.ok(child.stdout.includes(
    'Installing dependencies for service "external-service-1"'
  ))
  assert.ok(child.stdout.includes(
    'Installing dependencies for service "external-service-2"'
  ))
  assert.ok(child.stdout.includes(
    'Installing dependencies for service "external-service-3"'
  ))

  assert.ok(child.stdout.includes(
    'All external services have been installed'
  ))

  const config = JSON.parse(await readFile(join(dest, 'platformatic.json'), 'utf8'))
  assert.deepStrictEqual(config.services, [
    {
      id: 'piquant-combat',
      path: join('services', 'piquant-combat'),
      config: 'services/piquant-combat/platformatic.json',
      useHttp: false,
    },
    {
      id: 'external-service-1',
      url: 'http://github.com/test-owner/test-app-1.git',
      config: 'platformatic.json',
      path: join('external', 'external-service-1'),
    },
    {
      id: 'external-service-2',
      url: 'http://github.com/test-owner/test-app-2.git',
      config: 'platformatic.json',
      path: join('custom-external', 'external-service-2'),
    },
    {
      id: 'external-service-3',
      url: 'http://github.com/test-owner/test-app-3.git',
      config: 'platformatic.json',
      path: join('external', 'external-service-3'),
    },
  ])
})
