import { tmpdir } from 'os'
import { join } from 'path'
import { execa } from 'execa'
import t from 'tap'

import { isFileAccessible } from '../src/utils.mjs'
import { createGitRepository, GIT_FIRST_COMMIT_MESSAGE, GIT_MAIN_BRANCH } from '../src/create-git-repository.mjs'
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
t.beforeEach(async () => {
  loggerSpy.reset()
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(tmpDir, { recursive: true })
})

t.test('should create the git repo', async t => {
  await writeFile(join(tmpDir, 'README.md'), '')

  await createGitRepository(loggerSpy, tmpDir)

  t.equal(loggerSpy._debug[0][0], 'Git repository initialized.')
  t.equal(loggerSpy._debug[1][0], 'Git commit done.')
  t.equal(loggerSpy._info[0][0], 'Git repository initialized.')
  t.equal(loggerSpy._error.length, 0)

  t.equal(await isFileAccessible(join(tmpDir, '.git/config')), true)

  const lastCommit = await execa('git', ['show', '-1'], { cwd: tmpDir })
  t.match(lastCommit.stdout, GIT_FIRST_COMMIT_MESSAGE)

  const branch = await execa('git', ['branch'], { cwd: tmpDir })
  t.match(branch.stdout, GIT_MAIN_BRANCH)
})

t.test('should not create the git repository if already exists', async t => {
  await execa('git', ['init'], { cwd: tmpDir })

  await createGitRepository(loggerSpy, tmpDir)

  t.equal(loggerSpy._debug.length, 0)
  t.equal(loggerSpy._info[0][0], 'Git repository already exists.')
  t.equal(loggerSpy._error.length, 0)
})
