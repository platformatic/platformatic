import assert from 'node:assert'
import test from 'node:test'
import path from 'node:path'
import { cp, rm, mkdir } from 'node:fs/promises'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { fileURLToPath } from 'url'
import { cliPath, safeKill } from './helper.mjs'

process.setMaxListeners(100)

let count = 0

function urlDirname (url) {
  return path.dirname(fileURLToPath(url))
}

async function getCWD (t) {
  const dir = path.join(urlDirname(import.meta.url), '..', 'tmp', `typescript-plugin-clone-2-${count++}`)
  try {
    await rm(dir, { recursive: true })
  } catch (error) {
    console.log(error)
  }

  await mkdir(dir, { recursive: true })

  // t.after(async () => {
  //   try {
  //     await rm(dir, { recursive: true })
  //   } catch (error) {
  //     console.log(error)
  //   }
  // })
  return dir
}

function exitOnTeardown (child) {
  return async () => {
    await safeKill(child)
  }
}

test('should start without a tsconfig but with a outDir configuration', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-compiled')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should start without a tsconfig but with a outDir configuration')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Typescript plugin loaded')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should compile typescript plugin with start command')
})

test('should compile typescript plugin with start command with custom flags', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-custom-flags')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  const child = execa('node', [cliPath, 'start'], { cwd })
  t.after(exitOnTeardown(child))

  const splitter = split()
  child.stdout.pipe(splitter)
  child.stderr.pipe(splitter)

  let output = ''

  const timeout = setTimeout(() => {
    console.log(output)
    assert.fail('should compile typescript plugin with start command with custom flags')
  }, 30000)

  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    output += sanitized
    if (sanitized.includes('Typescript plugin loaded')) {
      clearTimeout(timeout)
      return
    }
  }
  assert.fail('should compile typescript plugin with start command')
})
