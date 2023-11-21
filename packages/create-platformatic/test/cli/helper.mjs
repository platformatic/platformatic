import os from 'node:os'
import { execa } from 'execa'
import { join } from 'desm'
import stripAnsi from 'strip-ansi'
import { promisify } from 'node:util'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const sleep = promisify(setTimeout)

export const keys = {
  DOWN: '\x1B\x5B\x42',
  UP: '\x1B\x5B\x41',
  ENTER: '\x0D',
  SPACE: '\x20'
}

export const createPath = join(import.meta.url, '..', '..', 'create-platformatic.mjs')

const match = (str, match) => {
  if (Array.isArray(match)) {
    return match.some((m) => str.includes(m))
  }
  return str.includes(match)
}

export const walk = async (dir) => {
  let files = await fs.readdir(dir)
  files = await Promise.all(files.map(async file => {
    const filePath = path.join(dir, file)
    const stats = await fs.stat(filePath)
    if (stats.isDirectory()) return walk(filePath)
    else if (stats.isFile()) return filePath
  }))
  return files.reduce((all, folderContents) => all.concat(folderContents), [])
}

export const getServices = async (dir) => {
  const files = await fs.readdir(dir)
  const services = []
  for (const file of files) {
    services.push(file)
  }
  return services
}

// Actions are in the form:
// {
//    match: 'Server listening at',
//    do: [keys.DOWN, keys.ENTER]
// }
export async function executeCreatePlatformatic (dir, actions = [], done = 'All done!', pkgMgrInstall = false) {
  const runCreatePlatformatic = async () => {
    const questions = [...actions]
    try {
      const child = execa('node', [createPath, `--install=${pkgMgrInstall.toString()}`], { cwd: dir })

      // We just need the "lastPrompt" printed before the process stopped to wait for an answer
      // If we don't have any outptu from process for more than 500ms, we assume it's waiting for an answer
      let lastPrompt = ''

      child.stdout.on('data', (chunk) => {
        const str = stripAnsi(chunk.toString()).trim()
        if (str) {
          lastPrompt = str
        }
      })

      let expectedQuestion = questions.shift()

      // We need this because the prompt prints an introduction before asking anything.
      // If we don't like this, we could use a flag to recognize when the introduction is done
      await sleep(4000)

      while (true) {
        if (!expectedQuestion) {
          await sleep(200)
          // We processed all expected questions, so now we wait for the process to be done.
          // If the "done" string is not printed, the test will timeout
          if (lastPrompt && lastPrompt.includes(done)) {
            safeKill(child)
            return
          }
        } else if (match(lastPrompt, expectedQuestion.match)) {
          console.log('==> MATCH', expectedQuestion.match)
          lastPrompt = ''

          for (const key of expectedQuestion.do) {
            child.stdin?.write(key)
            const waitAfter = expectedQuestion.waitAfter || 500
            await sleep(waitAfter)
          }
          expectedQuestion = questions.shift()
        } else {
          throw new Error(`Expected ${expectedQuestion.match}, got ${lastPrompt}`)
        }
      }
    } catch (err) {
      console.error(err)
      throw err
    }
  }
  await runCreatePlatformatic()
}

export async function safeKill (child) {
  child.kill('SIGINT')
  if (os.platform() === 'win32') {
    try {
      await execa('taskkill', ['/pid', child.pid, '/f', '/t'])
    } catch (err) {
      if (err.stderr.indexOf('not found') === 0) {
        console.error(`Failed to kill process ${child.pid}`)
        console.error(err)
      }
    }
  }
}
