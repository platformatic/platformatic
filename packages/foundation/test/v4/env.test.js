import { deepStrictEqual, rejects } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  applyNodeEnvDefault,
  layerEnvironment,
  listEnvFileNames,
  resolveConfigurationEnvironment,
  resolveDirectoryChain,
  resolveEnvFileSources,
  resolveWorkerEnvironment,
  stripInjectedTopologyKeys
} from '../../lib/v4/index.js'
import { createTree } from './helper.js'

test('the recognized env files are the Vite set, most specific first', () => {
  deepStrictEqual(listEnvFileNames('staging'), ['.env.staging.local', '.env.staging', '.env.local', '.env'])
  deepStrictEqual(listEnvFileNames(undefined), ['.env.local', '.env'])
})

test('a chain runs from a directory up to and including its env root', async t => {
  const root = await createTree(t, { 'web/api/index.js': '' })

  deepStrictEqual(resolveDirectoryChain(join(root, 'web/api'), root), [
    join(root, 'web/api'),
    join(root, 'web'),
    root
  ])
})

test('a chain whose env root is not an ancestor is the directory alone', async t => {
  // An application outside the runtime's directory: its own env root is itself, and the deciding
  // file's chain supplies what lies under it.
  const root = await createTree(t, { 'shared/worker/index.js': '', 'proj/index.js': '' })
  const directory = join(root, 'shared/worker')

  deepStrictEqual(resolveDirectoryChain(directory, join(root, 'proj')), [directory])
})

test('intermediate directories layer, nearest winning', async t => {
  const root = await createTree(t, {
    '.env': 'FROM=root\nSHARED=root\n',
    'web/.env': 'SHARED=web\nMIDDLE=web\n',
    'web/api/.env': 'SHARED=api\n'
  })

  const sources = await resolveEnvFileSources({
    directory: join(root, 'web/api'),
    envRoot: root,
    decidingDirectory: root,
    decidingEnvRoot: root
  })

  const environment = resolveConfigurationEnvironment({ realEnv: {}, fileSources: sources })

  // web/.env participates because it is between the two ends. v3 read exactly one found file plus
  // the app's own, so no file could shadow the ones above it.
  deepStrictEqual(environment, { SHARED: 'api', MIDDLE: 'web', FROM: 'root' })
})

test('mode-specific beats generic and .local beats committed within one directory', async t => {
  const root = await createTree(t, {
    '.env': 'A=env\nB=env\nC=env\nD=env\n',
    '.env.local': 'A=local\nB=local\nC=local\n',
    '.env.staging': 'A=staging\nB=staging\n',
    '.env.staging.local': 'A=staging-local\n'
  })

  const sources = await resolveEnvFileSources({
    directory: root,
    envRoot: root,
    decidingDirectory: root,
    decidingEnvRoot: root,
    mode: 'staging'
  })

  deepStrictEqual(resolveConfigurationEnvironment({ realEnv: {}, fileSources: sources }), {
    A: 'staging-local',
    B: 'staging',
    C: 'local',
    D: 'env'
  })
})

test('the real environment always wins, over blocks and files alike', async t => {
  const root = await createTree(t, { '.env': 'SHARED=file\nONLY_FILE=file\n' })

  const sources = await resolveEnvFileSources({
    directory: root,
    envRoot: root,
    decidingDirectory: root,
    decidingEnvRoot: root
  })

  const worker = resolveWorkerEnvironment({
    realEnv: { SHARED: 'real' },
    entryEnv: { SHARED: 'entry', FROM_ENTRY: 'entry' },
    rootEnv: { SHARED: 'root', FROM_ENTRY: 'root', FROM_ROOT: 'root' },
    injectedUrls: { SHARED: 'injected', PLT_API_URL: 'http://api.plt.local' },
    fileSources: sources
  })

  // This top rung is a deliberate inversion of v3, where env blocks were pins applied over the
  // real environment. The entry block still beats the root block, matching v3's relative order.
  deepStrictEqual(worker, {
    SHARED: 'real',
    FROM_ENTRY: 'entry',
    FROM_ROOT: 'root',
    PLT_API_URL: 'http://api.plt.local',
    ONLY_FILE: 'file'
  })
})

test('env blocks are absent from the config-evaluation view at every position', async t => {
  const root = await createTree(t, { '.env': 'FROM_FILE=file\n' })

  const sources = await resolveEnvFileSources({
    directory: root,
    envRoot: root,
    decidingDirectory: root,
    decidingEnvRoot: root
  })

  const evaluation = resolveConfigurationEnvironment({ realEnv: { REAL: 'real' }, fileSources: sources })

  deepStrictEqual(evaluation, { REAL: 'real', FROM_FILE: 'file' })
})

test('an application outside the runtime directory inherits the deciding file chain', async t => {
  const root = await createTree(t, {
    'proj/watt.config.ts': '',
    'proj/.env': 'BASE=proj\nSHARED=proj\n',
    'shared/api/.env': 'SHARED=api\n'
  })

  const sources = await resolveEnvFileSources({
    directory: join(root, 'shared/api'),
    envRoot: join(root, 'shared/api'),
    decidingDirectory: join(root, 'proj'),
    decidingEnvRoot: join(root, 'proj')
  })

  deepStrictEqual(resolveConfigurationEnvironment({ realEnv: {}, fileSources: sources }), {
    SHARED: 'api',
    BASE: 'proj'
  })
})

test('envfile replaces the application own-directory layer and nothing above it', async t => {
  const root = await createTree(t, {
    '.env': 'BASE=root\n',
    'web/api/.env': 'OWN=own\n',
    'web/api/deploy.env': 'OWN=deploy\n'
  })

  const sources = await resolveEnvFileSources({
    directory: join(root, 'web/api'),
    envRoot: root,
    decidingDirectory: root,
    decidingEnvRoot: root,
    envfile: './deploy.env'
  })

  // None of the four mode-aware app files are read; the directories above are unaffected.
  deepStrictEqual(resolveConfigurationEnvironment({ realEnv: {}, fileSources: sources }), {
    OWN: 'deploy',
    BASE: 'root'
  })
})

test('a missing explicitly-named envfile is a load error, unlike the implicit set', async t => {
  const root = await createTree(t, { 'web/api/index.js': '' })

  await rejects(
    () =>
      resolveEnvFileSources({
        directory: join(root, 'web/api'),
        envRoot: root,
        decidingDirectory: root,
        decidingEnvRoot: root,
        envfile: './missing.env'
      }),
    { code: 'PLT_ENV_FILE_NOT_FOUND' }
  )

  // A directory at the path is the same authoring mistake, and gets the same named error rather
  // than a raw EISDIR.
  await rejects(
    () =>
      resolveEnvFileSources({
        directory: join(root, 'web/api'),
        envRoot: root,
        decidingDirectory: root,
        decidingEnvRoot: root,
        envfile: '.'
      }),
    { code: 'PLT_ENV_FILE_NOT_FOUND' }
  )

  // And a path stepping through a file -- index.js exists here, as a file -- is a raw ENOTDIR by
  // errno, the same mistake by the same rule.
  await rejects(
    () =>
      resolveEnvFileSources({
        directory: join(root, 'web/api'),
        envRoot: root,
        decidingDirectory: root,
        decidingEnvRoot: root,
        envfile: './index.js/nested'
      }),
    { code: 'PLT_ENV_FILE_NOT_FOUND' }
  )
})

test('--env replaces the entire env-files rung and is mode-exempt', async t => {
  const root = await createTree(t, {
    '.env': 'BASE=root\n',
    '.env.staging': 'BASE=staging\n',
    'web/api/.env': 'OWN=own\n',
    'custom.env': 'ONLY=custom\n'
  })

  const sources = await resolveEnvFileSources({
    directory: join(root, 'web/api'),
    envRoot: root,
    decidingDirectory: root,
    decidingEnvRoot: root,
    mode: 'staging',
    customEnvFile: join(root, 'custom.env')
  })

  // Defining it as merely the outermost layer would leave it overridden by any application's own
  // .env, which is not what an escape hatch is.
  deepStrictEqual(resolveConfigurationEnvironment({ realEnv: {}, fileSources: sources }), { ONLY: 'custom' })
})

test('NODE_ENV defaults to production under production when nothing supplied a non-empty value', () => {
  deepStrictEqual(applyNodeEnvDefault({}, true), { NODE_ENV: 'production' })
  deepStrictEqual(applyNodeEnvDefault({ NODE_ENV: '' }, true), { NODE_ENV: 'production' })
  deepStrictEqual(applyNodeEnvDefault({ NODE_ENV: 'staging' }, true), { NODE_ENV: 'staging' })
  deepStrictEqual(applyNodeEnvDefault({}, false), {})
  deepStrictEqual(applyNodeEnvDefault({ NODE_ENV: '' }, false), { NODE_ENV: '' })
})

test('layering takes the first source that defines a key, with no apply-and-overwrite passes', () => {
  deepStrictEqual(layerEnvironment([{ A: '1' }, { A: '2', B: '2' }, undefined, { C: '3' }]), {
    A: '1',
    B: '2',
    C: '3'
  })

  // An empty string is a value somebody wrote — the one exception is NODE_ENV, above.
  deepStrictEqual(layerEnvironment([{ A: '' }, { A: 'later' }]), { A: '' })
  deepStrictEqual(layerEnvironment([{ A: undefined }, { A: 'later' }]), { A: 'later' })
})

test('topology-key stripping is scoped to keys the runtime is going to supply itself', () => {
  const environment = { PLT_API_URL: 'stale', PLT_DB_URL: 'inherited', PLT_STRIPE_URL: 'unrelated' }

  stripInjectedTopologyKeys(environment, ['PLT_API_URL', 'PLT_DB_URL'], { PLT_DB_URL: 'inherited' })

  // A key already present in the runtime's own real environment is one injection skips, so the
  // worker genuinely uses the inherited value and stripping it would make the views disagree.
  deepStrictEqual(environment, { PLT_DB_URL: 'inherited', PLT_STRIPE_URL: 'unrelated' })
})
