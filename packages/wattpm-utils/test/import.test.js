import { createDirectory, safeRemove } from '@platformatic/foundation'
import { capabilityFactories } from '@platformatic/foundation/lib/v4/index.js'
import { updateConfigFile } from '@platformatic/runtime/test/helpers.js'
import { deepStrictEqual, ok } from 'node:assert'
import { existsSync } from 'node:fs'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { test } from 'node:test'
import { prepareFixture, prepareRuntime } from '../../basic/test/helper.js'
import { version } from '../lib/version.js'
import { changeWorkingDirectory, createTemporaryDirectory, wattpmUtils } from './helper.js'

const autodetect = {
  astro: 'astro',
  node: null,
  next: 'next',
  nest: '@nestjs/core',
  nitro: 'nitro',
  nuxt: 'nuxt',
  'react-router': '@react-router/dev',
  remix: '@remix-run/dev',
  tanstack: '@tanstack/react-start',
  vite: 'vite'
}

/*
  The shape `import` writes into a v4 root — a remote application with no path, a local one with a
  literal relative path, the branch, and the alias case — is covered by the v4 tests at the bottom
  of this file. What v3 asserted here was the `{PLT_APPLICATION_<ID>_PATH}` indirection and the
  `.env` lines that carried it, neither of which v4 writes.
*/
test('import - should not do anything when the local folder is already an autoloaded application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.config.mjs')

  const originalFileContents = await readFile(configurationFile, 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', resolve(rootDir, 'web/main'))

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)
  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'RUNTIME_ENV=foo')
  ok(!existsSync(resolve(rootDir, '.env.sample')))

  deepStrictEqual(importProcess.exitCode, 0)
  ok(importProcess.stdout.includes('The path is already autoloaded as an application.'))
})

test('import - should not do anything when the local folder is already a defined application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.config.mjs')

  await updateConfigFile(configurationFile, config => {
    config.applications = [{ id: 'main', path: 'main' }]
  })
  await createDirectory(resolve(rootDir, 'main'))
  await writeFile(resolve(rootDir, 'main/index.js'), '', 'utf-8')
  await cp(resolve(rootDir, 'web/main/watt.config.js'), resolve(rootDir, 'main/watt.config.js'))

  const originalFileContents = await readFile(configurationFile, 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', 'main')

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)
  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'RUNTIME_ENV=foo')
  ok(!existsSync(resolve(rootDir, '.env.sample')))

  deepStrictEqual(importProcess.exitCode, 0)
  ok(importProcess.stdout.includes('The path is already defined as an application.'))
})

test('import - should not do anything when loaded vian application file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))
  await safeRemove(resolve(rootDir, 'watt.config.mjs'))

  const configurationFile = resolve(rootDir, 'web/main/watt.config.js')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  changeWorkingDirectory(t, resolve(rootDir, 'web/main'))
  const importProcess = await wattpmUtils('import', '.')

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)
  ok(importProcess.stdout.includes('The path is already defined as an application.'))
})

test('import - should raise an error when importing if the application id is already taken', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.config.mjs')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', rootDir, 'foo/bar', '-i', 'main', { reject: false })

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)
  deepStrictEqual(await readFile(resolve(rootDir, '.env'), 'utf-8'), 'RUNTIME_ENV=foo')
  ok(!existsSync(resolve(rootDir, '.env.sample')))

  deepStrictEqual(importProcess.exitCode, 1)
  ok(importProcess.stdout.includes('There is already an application main defined, please choose a different application ID.'))
})

test('import - should not create environment files for an imported application', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  await safeRemove(resolve(rootDir, '.env'))

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', 'http://github.com/foo/bar.git')

  const source = await readFile(resolve(rootDir, 'watt.config.mjs'), 'utf-8')
  ok(/url:\s*["']http:\/\/github\.com\/foo\/bar\.git["']/.test(source), source)

  /*
    v3 wrote a `PLT_APPLICATION_BAR_PATH` line into `.env` and `.env.sample` here, creating both if
    they were missing. v4 writes the URL into the configuration and nothing anywhere else, so a
    project that had no environment files still has none.
  */
  ok(!existsSync(resolve(rootDir, '.env')), 'no .env was written')
  ok(!existsSync(resolve(rootDir, '.env.sample')), 'no .env.sample was written')
})

test('import - should not modify an existing configuration file when importing a local folder', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  const directory = await createTemporaryDirectory(t, 'local-with-git')
  await writeFile(resolve(directory, 'index.js'), '', 'utf-8')

  const existing = "export default { module: '@platformatic/node' } // mine\n"
  await writeFile(resolve(directory, 'watt.config.mjs'), existing, 'utf-8')
  const id = basename(directory)

  changeWorkingDirectory(t, rootDir)
  await wattpmUtils('import', directory)

  const source = await readFile(resolve(rootDir, 'watt.config.mjs'), 'utf-8')
  ok(new RegExp(`id:\\s*["']${id}["']`).test(source), source)

  // A literal relative path out of the root, and no environment variable standing in for it.
  ok(/path:\s*["']\.\./.test(source), source)
  ok(!existsSync(resolve(rootDir, '.env.sample')), 'no .env.sample was written')

  deepStrictEqual(await readFile(resolve(directory, 'watt.config.mjs'), 'utf-8'), existing)
})

for (const [name, dependency] of Object.entries(autodetect)) {
  test(`import - should correctly autodetect a @platformatic/${name} capability when importing local folders`, async t => {
    const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
    t.after(() => safeRemove(rootDir))

    const configurationFile = resolve(rootDir, 'watt.config.mjs')

    const directory = await createTemporaryDirectory(t, 'local-with-git')
    await writeFile(resolve(directory, 'index.js'), '', 'utf-8')
    if (dependency) {
      await writeFile(
        resolve(directory, 'package.json'),
        JSON.stringify({ dependencies: { [dependency]: '*' } }),
        'utf-8'
      )
    }

    const id = basename(directory)

    changeWorkingDirectory(t, rootDir)
    await wattpmUtils('import', directory)

    const source = await readFile(configurationFile, 'utf-8')
    ok(new RegExp(`id:\\s*["']${id}["']`).test(source), source)
    ok(/path:\s*["']\.\./.test(source), source)

    deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf-8')), {
      dependencies: {
        ...(dependency ? { [dependency]: '*' } : {}),
        [`@platformatic/${name}`]: `^${version}`
      }
    })

    /*
      The per-application file is v4: the capability's own factory when it ships one, so the file
      is the shape a person would have written by hand. The imported package declares no
      `"type": "module"`, so it is `.mjs` — `export default` in a CommonJS `.js` is a syntax error.
    */
    const factory = capabilityFactories[`@platformatic/${name}`]
    deepStrictEqual(
      await readFile(resolve(directory, 'watt.config.mjs'), 'utf-8'),
      `import { ${factory} } from '@platformatic/${name}'\n\nexport default ${factory}({})\n`
    )
  })
}

test('import - should fail when an application type cannot be detected', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  const directory = await createTemporaryDirectory(t, 'local-with-git')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', directory, { reject: false })

  deepStrictEqual(importProcess.exitCode, 1)
  ok(importProcess.stdout.includes(`The path ${directory} does not contain a supported application.`))
})

test('import - when launched without arguments, should fix the configuration of all known applications', async t => {
  /*
    A fixture copy rather than a runtime: `no-dependencies` is deliberately missing the capabilities
    its applications need, which is what this command installs, and v4 validates them when the root
    is read — so creating a runtime over it fails before `import` can run.
  */
  const { root: rootDir } = await prepareFixture(t, 'no-dependencies')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.config.mjs')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  await writeFile(resolve(rootDir, '.npmrc'), 'dry-run=true\n', 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import')

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)

  for (const applicationPath of ['web-1/first', 'web-1/second']) {
    deepStrictEqual(JSON.parse(await readFile(resolve(rootDir, applicationPath, 'package.json'), 'utf-8')), {
      dependencies: {
        '@platformatic/node': `^${version}`
      }
    })

    deepStrictEqual(
      await readFile(resolve(rootDir, applicationPath, 'watt.config.mjs'), 'utf-8'),
      "import { node } from '@platformatic/node'\n\nexport default node({})\n"
    )
  }

  // Untouched: `import` leaves an application that already has a configuration alone.
  ok((await readFile(resolve(rootDir, 'web-2/third/watt.config.js'), 'utf-8')).includes('marker: do not rewrite'))

  ok(
    importProcess.stdout.includes(
      'Application first is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(
    importProcess.stdout.includes(
      'Application second is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(
    importProcess.stdout.includes(
      'Application fourth is using Vite. Adding @platformatic/vite to its package.json dependencies.'
    )
  )
  ok(
    !importProcess.stdout.includes(
      'Application thid is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(importProcess.stdout.includes('Installing dependencies for the project using npm ...'))
  ok(importProcess.stdout.includes('Installing dependencies for the application first using npm ...'))
  ok(importProcess.stdout.includes('Installing dependencies for the application second using npm ...'))
  ok(importProcess.stdout.includes('Installing dependencies for the application fourth using npm ...'))
  ok(importProcess.stdout.includes('Installing dependencies for the application third using npm ...'))
})

test('import - should not install applications individually inside a pnpm workspace', async t => {
  /*
    A fixture copy rather than a runtime: `no-dependencies` is deliberately missing the capabilities
    its applications need, which is what this command installs, and v4 validates them when the root
    is read — so creating a runtime over it fails before `import` can run.
  */
  const { root: rootDir } = await prepareFixture(t, 'no-dependencies')
  t.after(() => safeRemove(rootDir))

  await writeFile(resolve(rootDir, '.npmrc'), 'dry-run=true\n', 'utf-8')
  await writeFile(
    resolve(rootDir, 'pnpm-workspace.yaml'),
    `packages:
  - web-1/*
  - web-2/*

catalog:
  vite: ^5.0.0
`,
    'utf-8'
  )
  await writeFile(
    resolve(rootDir, 'web-1/fourth/package.json'),
    JSON.stringify({ dependencies: { '@platformatic/globals': '>=3.0.0', vite: 'catalog:' } }),
    'utf-8'
  )

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', '-P', 'pnpm')

  ok(importProcess.stdout.includes('Installing dependencies for the project using pnpm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application first using pnpm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application second using pnpm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application fourth using pnpm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application third using pnpm ...'))
})

test('import - when launched without arguments, should fix the configuration of all known applications without installing dependencies', async t => {
  /*
    A fixture copy rather than a runtime: `no-dependencies` is deliberately missing the capabilities
    its applications need, which is what this command installs, and v4 validates them when the root
    is read — so creating a runtime over it fails before `import` can run.
  */
  const { root: rootDir } = await prepareFixture(t, 'no-dependencies')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.config.mjs')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  changeWorkingDirectory(t, rootDir)
  const importProcess = await wattpmUtils('import', '-s')

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)

  for (const applicationPath of ['web-1/first', 'web-1/second']) {
    deepStrictEqual(JSON.parse(await readFile(resolve(rootDir, applicationPath, 'package.json'), 'utf-8')), {
      dependencies: {
        '@platformatic/node': `^${version}`
      }
    })

    deepStrictEqual(
      await readFile(resolve(rootDir, applicationPath, 'watt.config.mjs'), 'utf-8'),
      "import { node } from '@platformatic/node'\n\nexport default node({})\n"
    )
  }

  // Untouched: `import` leaves an application that already has a configuration alone.
  ok((await readFile(resolve(rootDir, 'web-2/third/watt.config.js'), 'utf-8')).includes('marker: do not rewrite'))

  ok(
    importProcess.stdout.includes(
      'Application first is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(
    importProcess.stdout.includes(
      'Application second is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(
    importProcess.stdout.includes(
      'Application fourth is using Vite. Adding @platformatic/vite to its package.json dependencies.'
    )
  )
  ok(
    !importProcess.stdout.includes(
      'Application thid is a generic Node.js application. Adding @platformatic/node to its package.json dependencies.'
    )
  )
  ok(!importProcess.stdout.includes('Installing dependencies for the project using npm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application first using npm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application second using npm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application fourth using npm ...'))
  ok(!importProcess.stdout.includes('Installing dependencies for the application third using npm ...'))
})

test('import - when launched without arguments from an application file, should not do anything', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  // The root is gone, so web/main's own configuration is the only one there is.
  await safeRemove(resolve(rootDir, 'watt.config.mjs'))

  changeWorkingDirectory(t, resolve(rootDir, 'web/main'))
  const importProcess = await wattpmUtils('import')

  deepStrictEqual(JSON.parse(await readFile(resolve(rootDir, 'web/main/package.json'), 'utf-8')), {
    dependencies: {
      '@platformatic/globals': '>=3.0.0',
      '@platformatic/node': '>=3.0.0'
    },
    type: 'module'
  })

  ok(!importProcess.stdout.includes('Detected capability'))
})

test('import - should find the nearest configuration file', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'main', false, 'watt.config.mjs')
  t.after(() => safeRemove(rootDir))

  const configurationFile = resolve(rootDir, 'watt.config.mjs')
  const originalFileContents = await readFile(configurationFile, 'utf-8')

  const directory = resolve(rootDir, 'web/next')
  await createDirectory(directory)
  await writeFile(resolve(directory, 'index.js'), '', 'utf-8')

  changeWorkingDirectory(t, resolve(rootDir, 'web/next'))
  await wattpmUtils('import', '.')

  deepStrictEqual(await readFile(configurationFile, 'utf-8'), originalFileContents)

  ok(!existsSync(resolve(directory, 'web/next/package.json')))
  ok(!existsSync(resolve(directory, 'web/next/watt.config.mjs')))
})

async function prepareV4Root (t, root, contents) {
  await writeFile(resolve(root, 'package.json'), JSON.stringify({ name: 'root', type: 'module' }), 'utf-8')
  await writeFile(resolve(root, 'watt.config.js'), contents, 'utf-8')
  changeWorkingDirectory(t, root)
}

test('import - a remote application in a v4 root is written without a path', async t => {
  const root = await createTemporaryDirectory(t, 'import-v4')

  await prepareV4Root(
    t,
    root,
    [
      'export default {',
      '  // The level, once, so every application agrees on it.',
      '  logger: { level: process.env.PLT_LOG_LEVEL ?? \'info\' },',
      '  applications: []',
      '}',
      ''
    ].join('\n')
  )

  await wattpmUtils('import', 'http://github.com/foo/bar.git')

  const source = await readFile(resolve(root, 'watt.config.js'), 'utf-8')

  // What the root said is still what it says: the comment and the reference both survive.
  ok(source.includes('// The level, once, so every application agrees on it.'), source)
  ok(source.includes("process.env.PLT_LOG_LEVEL ?? 'info'"), source)

  ok(/id:\s*["']bar["']/.test(source), source)
  ok(/url:\s*["']http:\/\/github\.com\/foo\/bar\.git["']/.test(source), source)

  /*
    No path and no variable: v3 wrote an empty `PLT_APPLICATION_BAR_PATH` here, which reads as the
    project root in every clone that does not have the gitignored file it lives in.
  */
  ok(!source.includes('path'), source)
  ok(!existsSync(resolve(root, '.env')), 'no .env was written')
})

test('import - a local application outside a v4 root is written as a relative path', async t => {
  const root = await createTemporaryDirectory(t, 'import-v4-outside')
  const applicationDirectory = await createTemporaryDirectory(t, 'import-v4-elsewhere')

  await prepareV4Root(t, root, 'export default { applications: [] }\n')
  await writeFile(resolve(applicationDirectory, 'index.js'), '', 'utf-8')
  await writeFile(resolve(applicationDirectory, 'package.json'), JSON.stringify({ name: 'elsewhere' }), 'utf-8')

  await wattpmUtils('import', applicationDirectory)

  const source = await readFile(resolve(root, 'watt.config.js'), 'utf-8')

  /*
    Relative and literal, even leaving the project. v3 wrote a `{PLT_APPLICATION_<ID>_PATH}` and an
    `.env` line for this case; the indirection said nothing the path does not, and its value went
    missing in every clone.
  */
  ok(new RegExp(`path:\\s*["']\\.\\./[^"']*${basename(applicationDirectory)}["']`).test(source), source)
  ok(!existsSync(resolve(root, '.env')), 'no .env was written')
})

test('import - a remote application in a v4 root records its branch', async t => {
  const root = await createTemporaryDirectory(t, 'import-v4-branch')

  await prepareV4Root(t, root, 'export default { applications: [] }\n')
  await wattpmUtils('import', '-b', 'another', 'http://github.com/foo/bar.git')

  const source = await readFile(resolve(root, 'watt.config.js'), 'utf-8')
  ok(/gitBranch:\s*["']another["']/.test(source), source)
})

test('import - a v4 root that lists its applications under an alias keeps that name', async t => {
  const root = await createTemporaryDirectory(t, 'import-v4-alias')

  await prepareV4Root(t, root, "export default { web: [{ id: 'first', path: 'first' }] }\n")
  await wattpmUtils('import', 'http://github.com/foo/bar.git')

  const source = await readFile(resolve(root, 'watt.config.js'), 'utf-8')

  // One list, under the name the file already used, holding both entries.
  ok(!source.includes('applications'), source)
  ok(/id:\s*["']first["']/.test(source), source)
  ok(/id:\s*["']bar["']/.test(source), source)
})

test('import - a v4 root it cannot edit is printed rather than rewritten', async t => {
  const root = await createTemporaryDirectory(t, 'import-v4-unsafe')

  // The configuration is behind a binding, so there is no literal to append to.
  const original = 'const configuration = { applications: [] }\n\nexport default configuration\n'
  await prepareV4Root(t, root, original)

  const process = await wattpmUtils('import', 'http://github.com/foo/bar.git')

  ok(process.stdout.includes('Cannot edit watt.config.js automatically'), process.stdout)
  ok(process.stdout.includes('http://github.com/foo/bar.git'), process.stdout)
  deepStrictEqual(await readFile(resolve(root, 'watt.config.js'), 'utf-8'), original)
})

test('import - a local application inside a v4 root gets a relative path and a v4 file', async t => {
  const root = await createTemporaryDirectory(t, 'import-v4-local')

  await prepareV4Root(t, root, 'export default { applications: [] }\n')

  const applicationDirectory = resolve(root, 'web/main')
  await createDirectory(applicationDirectory)
  await writeFile(resolve(applicationDirectory, 'index.js'), '', 'utf-8')
  await writeFile(resolve(applicationDirectory, 'package.json'), JSON.stringify({ name: 'main' }), 'utf-8')

  await wattpmUtils('import', applicationDirectory)

  const source = await readFile(resolve(root, 'watt.config.js'), 'utf-8')

  // Inside the root, so the path is the project's own and needs no variable to say it.
  ok(/path:\s*["']web\/main["']/.test(source), source)
  ok(!existsSync(resolve(root, '.env')), 'no .env was written')

  /*
    The per-application file is v4 too. A `watt.json` beside a v4 root is the coexistence the loader
    refuses, so writing one here would leave a project that no longer boots.
  */
  ok(!existsSync(resolve(applicationDirectory, 'watt.json')), 'no watt.json was written')

  /*
    `.mjs` rather than `.js`: the imported package does not declare `"type": "module"`, and the
    `export default` this writes is a syntax error in a CommonJS `.js`.
  */
  const applicationSource = await readFile(resolve(applicationDirectory, 'watt.config.mjs'), 'utf-8')
  deepStrictEqual(applicationSource, "import { node } from '@platformatic/node'\n\nexport default node({})\n")
})

test('import - a v4 root leaves an application that already has a configuration alone', async t => {
  const root = await createTemporaryDirectory(t, 'import-v4-configured')

  await prepareV4Root(t, root, 'export default { applications: [] }\n')

  const applicationDirectory = resolve(root, 'web/main')
  await createDirectory(applicationDirectory)
  await writeFile(resolve(applicationDirectory, 'index.js'), '', 'utf-8')
  await writeFile(resolve(applicationDirectory, 'package.json'), JSON.stringify({ name: 'main' }), 'utf-8')

  const existing = "import { node } from '@platformatic/node'\n\nexport default node({ /* mine */ })\n"
  await writeFile(resolve(applicationDirectory, 'watt.config.mjs'), existing, 'utf-8')

  await wattpmUtils('import', applicationDirectory)

  deepStrictEqual(await readFile(resolve(applicationDirectory, 'watt.config.mjs'), 'utf-8'), existing)
})
