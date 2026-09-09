import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { EnvFileNotFoundError } from './errors.js'
import { ancestorDirectories } from './scope.js'

// Vite parity. Ordered most specific first, which is the order the layering consumes:
// .env.<mode>.local > .env.<mode> > .env.local > .env
export function listEnvFileNames (mode) {
  const names = []

  if (mode) {
    names.push(`.env.${mode}.local`, `.env.${mode}`)
  }

  names.push('.env.local', '.env')

  return names
}

// A chain runs from `directory` up to and including `envRoot`, nearest winning. When `envRoot` is
// not an ancestor of `directory` — an application outside the runtime's tree, whose own env root
// is itself — the chain is the directory alone. Every chain terminates.
export function resolveDirectoryChain (directory, envRoot) {
  const chain = []

  for (const candidate of ancestorDirectories(directory)) {
    chain.push(candidate)

    if (candidate === envRoot) {
      return chain
    }
  }

  return [directory]
}

async function readEnvFile (path, { required = false } = {}) {
  let contents

  try {
    contents = await readFile(path, 'utf-8')
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR' || error.code === 'ENOTDIR') {
      // A directory at the path, or a file standing where the path expects a directory, is the
      // same authoring mistake as nothing there: the named env file is not a file that can be
      // read, and the named error beats a raw errno.
      if (required) {
        throw new EnvFileNotFoundError(path)
      }

      return null
    }

    throw error
  }

  return { path, values: parseEnv(contents) }
}

// Every path a directory contributes, whether or not it exists. The watcher needs the full set:
// creating a .env is how a rung appears, and a set built from what exists cannot see that.
export function listDirectoryEnvFilePaths (directory, mode) {
  return listEnvFileNames(mode).map(name => resolve(directory, name))
}

export function listChainEnvFilePaths (chain, mode) {
  return chain.flatMap(directory => listDirectoryEnvFilePaths(directory, mode))
}

async function collectPaths (paths, { required = false } = {}) {
  const sources = await Promise.all(paths.map(path => readEnvFile(path, { required })))

  return sources.filter(source => source !== null)
}

// The env-files rung for one application, most specific first: its own chain layered over the
// chain of the file that decided the boot. For an application inside the project the two chains
// coincide and the second contributes nothing.
export async function resolveEnvFileSources ({
  directory,
  envRoot,
  decidingDirectory,
  decidingEnvRoot,
  mode,
  envfile,
  customEnvFile
}) {
  // --env replaces the entire rung, in both views and mode-exempt: no directory in any chain
  // contributes. Defining it as merely the outermost layer would leave it overridden by any
  // application's own .env, which is not what an escape hatch is.
  if (customEnvFile) {
    const path = isAbsolute(customEnvFile) ? customEnvFile : resolve(directory ?? decidingDirectory, customEnvFile)

    return collectPaths([path], { required: true })
  }

  const ownChain = directory ? resolveDirectoryChain(directory, envRoot ?? directory) : []
  const decidingChain = decidingDirectory
    ? resolveDirectoryChain(decidingDirectory, decidingEnvRoot ?? decidingDirectory)
    : []

  const sources = []

  if (envfile) {
    // envfile is an opt-out of the convention that occupies the application's own-directory layer:
    // none of the four mode-aware files are read for it, and the directories above are unaffected.
    // It resolves app-relative and a missing one is a load error.
    const path = isAbsolute(envfile) ? envfile : resolve(directory, envfile)

    sources.push(...(await collectPaths([path], { required: true })))
    sources.push(...(await collectPaths(listChainEnvFilePaths(ownChain.slice(1), mode))))
  } else {
    sources.push(...(await collectPaths(listChainEnvFilePaths(ownChain, mode))))
  }

  sources.push(...(await collectPaths(listChainEnvFilePaths(decidingChain, mode))))

  const seen = new Set()

  return sources.filter(source => {
    if (seen.has(source.path)) {
      return false
    }

    seen.add(source.path)
    return true
  })
}

// Resolution is declarative: for each key, walk the ladder from the top and take the first source
// that defines it. There are no sequential apply-and-overwrite passes, so the ordering bugs they
// invite — an app env file clobbering a value an env block just set — are unrepresentable.
export function layerEnvironment (layers) {
  const environment = {}

  for (const layer of layers) {
    if (!layer) {
      continue
    }

    for (const key of Object.keys(layer)) {
      const value = layer[key]

      if (value === undefined || key in environment) {
        continue
      }

      environment[key] = typeof value === 'string' ? value : String(value)
    }
  }

  return environment
}

// The bottom rung, and it belongs to both views. The test is non-empty rather than absent because
// that is what v3 tested: a production build running with NODE_ENV='' is read by every bundler in
// the ecosystem as "not production". This is the one place the ladder treats '' as missing.
export function applyNodeEnvDefault (environment, production) {
  if (production && !environment.NODE_ENV) {
    environment.NODE_ENV = 'production'
  }

  return environment
}

// The config-evaluation view: real environment > env files > NODE_ENV default. No env block
// appears at any position — a block configures the running application, not the reading of
// configuration.
export function resolveConfigurationEnvironment ({ realEnv = process.env, fileSources = [], production = false }) {
  const environment = layerEnvironment([realEnv, ...fileSources.map(source => source.values)])

  return applyNodeEnvDefault(environment, production)
}

// The worker-runtime view. It differs from the one above by exactly the rungs that exist only once
// the runtime is running: the two env blocks and the injected PLT_<ID>_URL values.
export function resolveWorkerEnvironment ({
  realEnv = process.env,
  entryEnv,
  rootEnv,
  injectedUrls,
  fileSources = [],
  production = false
}) {
  const environment = layerEnvironment([
    realEnv,
    entryEnv,
    rootEnv,
    injectedUrls,
    ...fileSources.map(source => source.values)
  ])

  return applyNodeEnvDefault(environment, production)
}

// Injection outranks env files, so a per-app eval worker must not read a stale PLT_<ID>_URL out of
// one and bake it into resolvedConfig, where injection can no longer reach it. The strip is scoped
// to names the runtime is going to supply itself: a key already in the real environment is one
// injection skips, so the worker genuinely uses the inherited value and it stays.
export function stripInjectedTopologyKeys (environment, injectedNames, realEnv = process.env) {
  for (const name of injectedNames) {
    if (name in realEnv) {
      continue
    }

    delete environment[name]
  }

  return environment
}
