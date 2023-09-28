import assert from 'node:assert'
import test from 'node:test'
import path from 'node:path'
import { cp, rm, mkdir } from 'node:fs/promises'
// import { access, cp, rm, mkdir } from 'node:fs/promises'
import { execa } from 'execa'
// import stripAnsi from 'strip-ansi'
// import split from 'split2'
import { fileURLToPath } from 'url'
// import { cliPath } from './helper.mjs'
import { cliPath, safeKill } from './helper.mjs'
import psList from 'ps-list'

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
    // console.log(error)
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

// function exitOnTeardown (child) {
//   return async () => {
//     await safeKill(child)
//   }
// }

// test('start command should not compile typescript if `typescript` is false', async (t) => {
//   const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin-nocompile')
//   const cwd = await getCWD(t)

//   await cp(testDir, cwd, { recursive: true })

//   const child = execa('node', [cliPath, 'start'], { cwd })
//   t.after(exitOnTeardown(child))

//   const jsPluginPath = path.join(cwd, 'dist', 'plugin.js')
//   try {
//     await access(jsPluginPath)
//     assert.fail("should not have created 'dist/plugin.js'")
//   } catch (err) {
//     // cannot start because the plugin is not compiled
//     assert.strictEqual(err.code, 'ENOENT')
//     assert.strictEqual(err.path, jsPluginPath)
//   }
// })

// test('should compile typescript plugin with start command with different cwd', async (t) => {
//   const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
//   const dest = path.join(urlDirname(import.meta.url), '..', 'tmp', `typescript-plugin-clone2-${count++}`)

//   await cp(testDir, dest, { recursive: true })

//   const child = execa('node', [cliPath, 'start', '-c', path.join(dest, 'platformatic.service.json')])
//   t.after(exitOnTeardown(child))

//   const splitter = split()
//   child.stdout.pipe(splitter)
//   child.stderr.pipe(splitter)

//   let output = ''

//   const timeout = setTimeout(() => {
//     console.log(output)
//     assert.fail('should compile typescript plugin with start command')
//   }, 30000)

//   for await (const data of splitter) {
//     const sanitized = stripAnsi(data)
//     output += sanitized
//     if (sanitized.includes('Typescript plugin loaded')) {
//       clearTimeout(timeout)
//       return
//     }
//   }
//   assert.fail('should compile typescript plugin with start command')
// })

test('valid tsconfig file inside an inner folder', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-plugin')
  const cwd = await getCWD(t)

  await cp(testDir, cwd, { recursive: true })

  try {
    const child = execa('node', [cliPath, 'compile'], {
      cwd,
      killSignal: 'SIGKILL'
    })
    console.log('5')

    const timeout = setInterval(async () => {
      const processes = await psList()
      const level1 = processes.filter((p) => p.pid === child.pid)
      const level2 = processes.filter((p) => level1.includes(p.ppid))
      const level3 = processes.filter((p) => level2.includes(p.ppid))

      console.log('level1', level1)
      console.log('level2', level2)
      console.log('level3', level3)

      if (level1.length === 0) {
        clearInterval(timeout)
        return
      }

      for (const p of level1) {
        console.log('killing', p.pid)
        await safeKill(p.pid)
        await execa('kill', ['-9', p.pid])
        await execa('taskkill', ['/pid', p.pid, '/f', '/t'])
        await execa('wmic', ['process', 'where', `ProcessId=${p.pid}`, 'delete'])
      }
    }, 5000)

    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)

    await child

    // safeKill(parseInt(child.pid))

    console.log('6')
  } catch (err) {
    console.log(err)
    assert.fail('should not catch any error')
  }
})

// test('should compile typescript plugin with start command from a folder', async (t) => {
//   const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'typescript-autoload')
//   const cwd = await getCWD(t)

//   await cp(testDir, cwd, { recursive: true })

//   const child = execa('node', [cliPath, 'start'], { cwd })
//   t.after(exitOnTeardown(child))

//   const splitter = split()
//   child.stdout.pipe(splitter)
//   child.stderr.pipe(splitter)

//   let output = ''

//   const timeout = setTimeout(() => {
//     console.log(output)
//     assert.fail('should compile typescript plugin with start command')
//   }, 30000)

//   for await (const data of splitter) {
//     const sanitized = stripAnsi(data)
//     output += sanitized
//     if (sanitized.includes('Typescript plugin loaded')) {
//       clearTimeout(timeout)
//       return
//     }
//   }
//   assert.fail('should compile typescript plugin with start command')
// })
