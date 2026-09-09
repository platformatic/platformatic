import { createDirectory, safeRemove } from '@platformatic/foundation'
import { updateConfigFile } from '@platformatic/runtime/test/helpers.js'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { test } from 'node:test'
import { prepareFixture, prepareRuntime, temporaryFolder } from '../../basic/test/helper.js'
import { changeWorkingDirectory, prepareGitRepository, wattpmUtils } from './helper.js'

/*
  Where a remote application is checked out. v3 put the destination in the environment, under
  `PLT_APPLICATION_<ID>_PATH`, and the imported entry carried that variable's name as its path. v4
  writes no such indirection: an entry either declares a literal path or declares none, and one
  that declares none is checked out under `resolvedApplicationsBasePath` — `external/<id>`.
*/
function declarePath (rootDir, id, path) {
  return updateConfigFile(resolve(rootDir, 'watt.config.mjs'), config => {
    config.applications.find(application => application.id === id).path = path
  })
}

test('resolve - should clone a URL into the path the entry declares', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', repo)
  await declarePath(rootDir, 'resolved', 'web/resolved')

  const resolveProcess = await wattpmUtils('resolve', rootDir)

  ok(resolveProcess.stdout.includes(`Cloning ${repo} into web${sep}resolved`))
  ok(resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))

  deepStrictEqual(await readFile(resolve(rootDir, 'web/resolved/branch'), 'utf-8'), 'main')
})

test('resolve - should clone a URL into the default base path when the entry declares none', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', repo)

  const resolveProcess = await wattpmUtils('resolve', rootDir)

  ok(resolveProcess.stdout.includes(`Cloning ${repo} into ${join('external', 'resolved')}`))
  ok(resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))

  deepStrictEqual(await readFile(resolve(rootDir, 'external/resolved/branch'), 'utf-8'), 'main')
})

test('resolve - should do nothing when the directory already exists inside the repo', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', repo)

  await createDirectory(resolve(rootDir, 'whatever'))
  await declarePath(rootDir, 'resolved', 'whatever')

  const resolveProcess = await wattpmUtils('resolve', rootDir)
  ok(!resolveProcess.stdout.includes(`Cloning ${repo}`))
  ok(!resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))
})

test('resolve - should do nothing when loaded vian application file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  // The root is gone, so web/main's own configuration is the only one there is: a standalone
  // application, which resolve has nothing to do for.
  await safeRemove(resolve(rootDir, 'watt.config.mjs'))

  changeWorkingDirectory(t, resolve(rootDir, 'web/main'))
  const resolveProcess = await wattpmUtils('resolve', resolve(rootDir, 'web/main'))
  ok(!resolveProcess.stdout.includes(`Cloning ${repo}`))
  ok(!resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))
})

test('resolve - should do nothing when the directory already exists outside the repo', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', repo)

  const outside = resolve(temporaryFolder, 'outside-' + process.pid)
  await createDirectory(outside)
  t.after(() => safeRemove(outside))
  await declarePath(rootDir, 'resolved', outside)

  const resolveProcess = await wattpmUtils('resolve', rootDir)
  ok(!resolveProcess.stdout.includes(`Cloning ${repo}`))
  ok(!resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))
})

test('resolve - should do nothing when the autogenerated directory already exists inside the repo', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', repo)
  await createDirectory(resolve(rootDir, 'external/resolved'))

  const resolveProcess = await wattpmUtils('resolve', rootDir)
  ok(!resolveProcess.stdout.includes(`Cloning ${repo}`))
  ok(!resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))
  ok(
    resolveProcess.stdout.includes(
      `Skipping application resolved as the generated path external${sep}resolved already exists.`
    ),
    resolveProcess.stdout
  )
})

test('resolve - should throw an error when the directory outside the repo do not exist', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', repo)

  const outside = resolve(temporaryFolder, 'missing-' + process.pid)
  await declarePath(rootDir, 'resolved', outside)

  const resolveProcess = await wattpmUtils('resolve', rootDir, { reject: false })
  ok(!resolveProcess.stdout.includes(`Cloning ${repo}`))
  ok(!resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))
  ok(
    resolveProcess.stdout.includes(
      `Skipping application resolved as the non existent directory ${outside} is outside the project directory.`
    )
  )
})

test('resolve - should attempt to clone with username and password', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  const url = 'https://127.0.0.1:60000/platformatic/wattpm-fixtures.git'
  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-i', 'resolved', url)
  const resolveProcess = await wattpmUtils('resolve', '-u', 'foo', '-p', 'bar', rootDir, { reject: false })

  ok(resolveProcess.stdout.includes(`Cloning ${url} as user foo`))
  ok(resolveProcess.stdout.includes(`Cloning into '${resolve(rootDir, 'external/resolved')}'`))
  ok(resolveProcess.stdout.includes('Unable to clone repository of the application resolved'))
})

test('resolve - should clone a different branch', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', '-b', 'another', repo)
  await declarePath(rootDir, 'resolved', 'web/resolved')

  const resolveProcess = await wattpmUtils('resolve', rootDir)

  ok(resolveProcess.stdout.includes(`Cloning ${repo} (branch another) into web${sep}resolved`))
  ok(resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))

  deepStrictEqual(await readFile(resolve(rootDir, 'web/resolved/branch'), 'utf-8'), 'another')
})

test('resolve - should install dependencies using a different package manager', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', repo)
  await declarePath(rootDir, 'resolved', 'web/resolved')

  const resolveProcess = await wattpmUtils('resolve', '-P', 'pnpm', rootDir)

  ok(resolveProcess.stdout.includes(`Cloning ${repo} into web${sep}resolved`))
  ok(resolveProcess.stdout.includes('Installing dependencies for the project using pnpm ...'))
  ok(resolveProcess.stdout.includes('Installing dependencies for the application resolved using pnpm ...'))

  deepStrictEqual(await readFile(resolve(rootDir, 'web/resolved/branch'), 'utf-8'), 'main')
})

test('resolve - should respect the application package manager, if any', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', repo)
  await declarePath(rootDir, 'resolved', 'web/resolved')

  await updateConfigFile(resolve(rootDir, 'watt.config.mjs'), config => {
    config.applications.find(application => application.id === 'resolved').packageManager = 'npm'
  })

  const resolveProcess = await wattpmUtils('resolve', '-P', 'pnpm', rootDir)

  ok(resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))
})

test('resolve - should parse branch from git URL fragment', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)

  // Use git URL with #branch fragment
  const gitUrlWithBranch = `${repo}#another`
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', gitUrlWithBranch)
  await declarePath(rootDir, 'resolved', 'web/resolved')

  const resolveProcess = await wattpmUtils('resolve', rootDir)

  ok(resolveProcess.stdout.includes(`Cloning ${repo}`))
  ok(resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))

  // Verify it cloned the 'another' branch, not 'main'
  deepStrictEqual(await readFile(resolve(rootDir, 'web/resolved/branch'), 'utf-8'), 'another')
})

test('resolve - branch flag should take precedence over URL fragment', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)

  // Use git URL with #main fragment, but specify -b another
  const gitUrlWithBranch = `${repo}#main`
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', '-b', 'another', gitUrlWithBranch)
  await declarePath(rootDir, 'resolved', 'web/resolved')

  const resolveProcess = await wattpmUtils('resolve', rootDir)

  ok(resolveProcess.stdout.includes(`Cloning ${repo}`))
  ok(resolveProcess.stdout.includes('branch another'))

  // Verify it cloned 'another' branch (from -b flag), not 'main' (from fragment)
  deepStrictEqual(await readFile(resolve(rootDir, 'web/resolved/branch'), 'utf-8'), 'another')
})

test('resolve - should clone a NPM package', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', rootDir, '-H', '-i', 'resolved', 'npm:@platformatic/foundation@3.37.0')

  const resolveProcess = await wattpmUtils('resolve', rootDir)

  ok(
    resolveProcess.stdout.includes(
      `Downloading npm package @platformatic/foundation@3.37.0 into ${join('external', 'resolved')}`
    )
  )
  ok(resolveProcess.stdout.includes('Installing dependencies for the application resolved using npm ...'))

  ok(existsSync(resolve(rootDir, 'external/resolved/package.json')))
  ok(existsSync(resolve(rootDir, 'external/resolved/index.js')))
  ok(existsSync(resolve(rootDir, 'external/resolved/lib/module.js')))
})

test('resolve - should refuse an invalid --for target', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  const resolveProcess = await wattpmUtils('resolve', rootDir, '--for', 'deploy', { reject: false })

  deepStrictEqual(resolveProcess.exitCode, 1)
  ok(resolveProcess.stdout.includes('Invalid value deploy for --for'))
})

test('resolve --for all - should refuse an id that resolves to two different clones', async t => {
  // prepareFixture, not prepareRuntime: the fixture's url reads an environment variable only
  // the CLI invocation supplies, so a load in this process would refuse the entry as placeless.
  const { root: rootDir } = await prepareFixture(t, 'resolve-branching')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)

  /*
    One directory cannot hold two checkouts, and choosing silently is how a deploy ships the wrong
    code. `--for build` alone is fine — it is only the union that has to decide.
  */
  const resolveProcess = await wattpmUtils('resolve', rootDir, '--for', 'all', {
    reject: false,
    env: { ...process.env, PLT_GIT_REPO_URL: repo }
  })

  deepStrictEqual(resolveProcess.exitCode, 1)
  ok(resolveProcess.stdout.includes('resolves to two different clones'))
  ok(resolveProcess.stdout.includes('gitBranch'))
})

test('resolve - should not let enabled: false hide an application', async t => {
  // prepareFixture, not prepareRuntime: the fixture's url reads an environment variable only
  // the CLI invocation supplies, so a load in this process would refuse the entry as placeless.
  const { root: rootDir } = await prepareFixture(t, 'resolve-disabled')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)

  /*
    The eval worker drops disabled entries before the application list leaves it, so resolve reads
    the candidates it recorded on the way past instead. Otherwise the boot that turns this
    application on fails on a directory nobody fetched.
  */
  const resolveProcess = await wattpmUtils('resolve', rootDir, '-s', {
    env: { ...process.env, PLT_GIT_REPO_URL: repo }
  })

  ok(resolveProcess.stdout.includes('Cloning'))
  ok(existsSync(resolve(rootDir, 'external/resolved')))
})

test('resolve - should refuse one destination claimed by two repositories', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'resolve-shared-destination', false, 'watt.config.mjs')
  const repo = await prepareGitRepository(t, rootDir)
  t.after(() => safeRemove(rootDir))

  changeWorkingDirectory(t, rootDir)

  /*
    The ids differ, so nothing keyed by id sees this: it is the destination that is claimed twice.
    Whichever clone lands second either overwrites the first or is silently skipped, and in both
    cases one of the two applications runs code from the other's repository.
  */
  const resolveProcess = await wattpmUtils('resolve', rootDir, {
    reject: false,
    env: { ...process.env, PLT_GIT_REPO_URL: repo }
  })

  deepStrictEqual(resolveProcess.exitCode, 1)
  ok(resolveProcess.stdout.includes('both resolve into'), resolveProcess.stdout)
  ok(resolveProcess.stdout.includes('somewhere-else'), resolveProcess.stdout)
})
