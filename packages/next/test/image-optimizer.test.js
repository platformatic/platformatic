import { safeRemove } from '@platformatic/foundation'
import { createDirectory } from '@platformatic/foundation/lib/file-system.js'
import { execa } from 'execa'
import { deepStrictEqual } from 'node:assert'
import { symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createTemporaryDirectory, prepareRuntime, setFixturesDir, startRuntime } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('can properly start a image optimizer only server (Next.js 15+)', async t => {
  const { runtime } = await prepareRuntime(t, 'image-optimizer', false, null)

  const url = await startRuntime(t, runtime)

  // Fetch an image from the external service
  {
    const { statusCode, headers } = await request(
      url + `/_next/image?url=${encodeURIComponent('https://example.com/image.png')}&w=1920&q=75`
    )

    deepStrictEqual(statusCode, 200)
    deepStrictEqual(headers['content-type'], 'image/png')
  }

  // Fetch an image from the internal service
  {
    const { statusCode, headers } = await request(url + '/_next/image?url=/platformatic.png&w=1920&q=75')
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(headers['content-type'], 'image/png')
  }

  // Simulate a network error
  {
    const { statusCode, body } = await request(
      url + `/_next/image?url=${encodeURIComponent('https://nonexistent.platformatic.dev/image.png')}&w=1920&q=75`
    )
    deepStrictEqual(statusCode, 502)
    deepStrictEqual(await body.json(), {
      cause: {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND nonexistent.platformatic.dev'
      },
      error: 'Bad Gateway',
      message: 'An error occurred while optimizing the image.',
      statusCode: 502
    })
  }

  // Simulate a HTTP error
  {
    const { statusCode, body } = await request(url + '/_next/image?url=/invalid.png&w=1920&q=75')
    deepStrictEqual(statusCode, 502)
    deepStrictEqual(await body.json(), {
      cause: {
        code: 'HTTP_ERROR_BAD_GATEWAY',
        message: 'Unable to fetch the image. [HTTP 404]'
      },
      error: 'Bad Gateway',
      message: 'An error occurred while optimizing the image.',
      statusCode: 502
    })
  }

  // Finally, send an invalid parameter to the optimizer
  {
    const { statusCode, body } = await request(url + '/_next/image?url=/platformatic.png&w=1920&q=10')
    deepStrictEqual(statusCode, 502)
    deepStrictEqual(await body.json(), {
      cause: {
        message: 'Invalid optimization parameters.',
        reason: '"q" parameter (quality) of 10 is not allowed'
      },
      error: 'Bad Gateway',
      message: 'An error occurred while optimizing the image.',
      statusCode: 502
    })
  }
})

test('can properly start a image optimizer only server (Next.js 14+)', async t => {
  const { root, runtime } = await prepareRuntime(t, 'image-optimizer', false, null)

  const override = await createTemporaryDirectory(t, 'plt-next-image-optimizer', tmpdir())
  await createDirectory(override)
  await execa('pnpm', ['add', 'next@14.2.18', 'react@18.3.0', 'react-dom@18.3.0'], { cwd: override })

  await safeRemove(resolve(root, 'services/optimizer/node_modules/next'))
  await safeRemove(resolve(root, 'services/optimizer/node_modules/react'))
  await safeRemove(resolve(root, 'services/optimizer/node_modules/react-dom'))
  for (const mod of ['next', 'react', 'react-dom']) {
    await symlink(resolve(override, 'node_modules', mod), resolve(root, 'services/optimizer/node_modules', mod), 'dir')
  }
  const url = await startRuntime(t, runtime)

  // Fetch an image from the external service
  {
    const { statusCode, headers } = await request(
      url + `/_next/image?url=${encodeURIComponent('https://example.com/image.png')}&w=1920&q=75`
    )

    deepStrictEqual(statusCode, 200)
    deepStrictEqual(headers['content-type'], 'image/png')
  }

  // Fetch an image from the internal service
  {
    const { statusCode, headers } = await request(url + '/_next/image?url=/platformatic.png&w=1920&q=75')
    deepStrictEqual(statusCode, 200)
    deepStrictEqual(headers['content-type'], 'image/png')
  }
})
