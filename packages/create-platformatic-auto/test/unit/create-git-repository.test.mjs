import { tmpdir } from 'os'
import { join } from 'path'
import { execa } from 'execa'
import { test } from 'node:test'
import { equal, match } from 'node:assert'

import { isFileAccessible } from '../../src/utils.mjs'
import { createGitRepository, GIT_FIRST_COMMIT_MESSAGE, GIT_MAIN_BRANCH } from '../../src/create-git-repository.mjs'
import { mkdir, rm, writeFile } from 'fs/promises'

const loggerSpy = {
  _debug: [],
  _info: [],
  _error: [],

  debug: function (...args) { this._debug.push(args) },
  info: function (...args) { this._info.push(args) },
  error: function (...args) { this._error.push(args) },

  reset: function () {
    this._debug = []
    this._info = []
    this._error = []
  }
}

const tmpDir = join(tmpdir(), 'test-create-platformatic-git-repo')
test.beforeEach(async () => {
  loggerSpy.reset()
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(tmpDir, { recursive: true })
})

test('should create the git repo', async () => {
  await writeFile(join(tmpDir, 'README.md'), '')

  await createGitRepository(loggerSpy, tmpDir)

  equal(loggerSpy._debug[0][0], 'Git repository initialized.')
  equal(loggerSpy._debug[1][0], 'Git commit done.')
  equal(loggerSpy._info[0][0], 'Git repository initialized.')
  equal(loggerSpy._error.length, 0)

  equal(await isFileAccessible(join(tmpDir, '.git/config')), true)

  const lastCommit = await execa('git', ['show', '-1'], { cwd: tmpDir })
  match(lastCommit.stdout, new RegExp(GIT_FIRST_COMMIT_MESSAGE))

  const branch = await execa('git', ['branch'], { cwd: tmpDir })
  match(branch.stdout, new RegExp(GIT_MAIN_BRANCH))
})

test('should not create the git repository if already exists', async () => {
  await execa('git', ['init'], { cwd: tmpDir })

  await createGitRepository(loggerSpy, tmpDir)

  equal(loggerSpy._debug.length, 0)
  equal(loggerSpy._info[0][0], 'Git repository already exists.')
  equal(loggerSpy._error.length, 0)
})
