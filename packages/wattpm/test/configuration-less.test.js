import { deepStrictEqual, ok } from 'node:assert'
import { readdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { test } from 'node:test'
import { changeWorkingDirectory, createTemporaryDirectory, startAndWaitForUrl, wattpm } from './helper.js'

/*
  Level 0. A directory with no configuration file of any kind boots on inferred defaults and
  nothing is written to disk. Synthesis happens in memory, so the tree is left exactly as it was
  found.
*/
test('build - when no configuration file exists, should boot on inferred defaults and write nothing', async t => {
  const rootDir = await createTemporaryDirectory(t, 'cli-build')
  await writeFile(resolve(rootDir, 'index.js'), '{}', 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const wattProcess = await wattpm('build', rootDir)

  ok(
    wattProcess.stdout.includes(
      `no configuration file found; booting ${rootDir} as @platformatic/node with inferred defaults`
    )
  )
  ok(wattProcess.stdout.includes('All applications have been built.'))

  // The compile cache is enabled by default and writes `.plt/`; that is runtime output, not a
  // configuration or source file, so it does not count against "nothing is written".
  deepStrictEqual((await readdir(rootDir)).filter(entry => entry !== '.plt'), ['index.js'])
})

for (const command of ['start', 'dev']) {
  test(`${command} - when no configuration file exists, should boot on inferred defaults and write nothing`, async t => {
    const rootDir = await createTemporaryDirectory(t, 'cli-start')
    await writeFile(
      resolve(rootDir, 'index.js'),
      `
import { createServer } from 'node:http'

// Port 0, not a fixed one: the start and dev cases run in sequence, and a fixed port outlives the
// process that held it -- on a slow Windows runner the previous case's socket is still bound when
// the next binds, and the boot this asserts on crashes with EADDRINUSE. An ephemeral port cannot
// collide, and the test only cares that the synthesized application comes up and is announced.
createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json', connection: 'close' }).end('{}')
}).listen(0)
      `,
      'utf-8'
    )

    changeWorkingDirectory(t, rootDir)

    // The synthesized application is named after the directory, which is also its mesh hostname.
    // Retry the whole boot: a dev/start boot can exit before announcing on a loaded Windows runner.
    const { url } = await startAndWaitForUrl(t, () => wattpm(command, rootDir), basename(rootDir))
    ok(url)

    // The compile cache is enabled by default and writes `.plt/`; that is runtime output, not a
  // configuration or source file, so it does not count against "nothing is written".
  deepStrictEqual((await readdir(rootDir)).filter(entry => entry !== '.plt'), ['index.js'])
  })
}
