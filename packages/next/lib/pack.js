import { saveConfigurationFile } from '@platformatic/foundation'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import {
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, relative, resolve as resolvePath } from 'node:path'
import { version as platformaticVersion } from './schema.js'

const runtimePackages = ['wattpm', '@platformatic/next']

export function resolveOutputDirectory (output, fallback, cwd) {
  const target = output ?? fallback
  return isAbsolute(target) ? target : resolvePath(cwd, target)
}

export async function prepareBundleDirectory (directory) {
  await rm(directory, { recursive: true, force: true })
  await mkdir(directory, { recursive: true })
}

export async function copyStandaloneFiles ({ applicationRoot, standaloneRoot, bundleRoot }) {
  await cp(standaloneRoot, bundleRoot, {
    recursive: true,
    dereference: true,
    preserveTimestamps: true
  })

  try {
    await cp(resolvePath(applicationRoot, '.next', 'static'), resolvePath(bundleRoot, '.next', 'static'), {
      recursive: true,
      force: true,
      errorOnExist: false,
      preserveTimestamps: true
    })
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }

  try {
    await cp(resolvePath(applicationRoot, 'public'), resolvePath(bundleRoot, 'public'), {
      recursive: true,
      force: true,
      errorOnExist: false,
      preserveTimestamps: true
    })
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

export async function writeBundleConfiguration (config, bundleRoot) {
  const bundleConfig = JSON.parse(JSON.stringify(config))
  bundleConfig.next ??= {}
  bundleConfig.next.standalone = true
  await saveConfigurationFile(resolvePath(bundleRoot, 'watt.json'), bundleConfig)
}

export async function materializeRuntimeDependencies ({ bundleRoot, logger }) {
  const bundleNodeModules = resolvePath(bundleRoot, 'node_modules')
  const stagingRoot = await mkdtemp(resolvePath(tmpdir(), 'platformatic-next-pack-'))

  try {
    await mkdir(bundleNodeModules, { recursive: true })

    const workspacePackages = await collectWorkspacePackages(runtimePackages)
    const tarballDirectory = resolvePath(stagingRoot, 'tarballs')
    const dependencies = {}
    const packages = new Map()

    await mkdir(tarballDirectory, { recursive: true })

    for (const name of runtimePackages) {
      const pkg = workspacePackages.get(name) ?? (await loadInstalledPackage(name, import.meta.url))
      packages.set(pkg.name, pkg)
    }

    for (const pkg of workspacePackages.values()) {
      const tarball = await packWorkspacePackage(pkg, tarballDirectory)
      dependencies[pkg.name] = `file:${relative(stagingRoot, tarball)}`
    }

    for (const pkg of packages.values()) {
      dependencies[pkg.name] ??= pkg.version
    }

    await writeFile(
      resolvePath(stagingRoot, 'package.json'),
      JSON.stringify({ name: 'platformatic-next-pack', private: true, dependencies }, null, 2),
      'utf-8'
    )

    await runCommand('npm', ['install', '--omit=dev', '--ignore-scripts', '--no-fund', '--no-audit'], { cwd: stagingRoot })
    await mergeDirectory(resolvePath(stagingRoot, 'node_modules'), bundleNodeModules)
    await cleanupBrokenSymlinks(resolvePath(bundleNodeModules, '.bin'))
    await writePackageBins(packages, bundleNodeModules)

    logger?.debug?.({ packages: [...packages.keys()] }, 'Materialized runtime packages for packed bundle.')

    return packages
  } finally {
    await rm(stagingRoot, { recursive: true, force: true })
  }
}

async function collectWorkspacePackages (rootNames) {
  const packages = new Map()
  const queue = [...rootNames]

  while (queue.length) {
    const name = queue.shift()
    if (packages.has(name)) {
      continue
    }

    const root = resolveWorkspacePackageRoot(name)
    if (!root) {
      continue
    }

    const pkg = await loadPackageFromRoot(root, name)
    packages.set(pkg.name, pkg)

    for (const dependencyName of listWorkspaceDependencies(pkg.packageJson)) {
      queue.push(dependencyName)
    }
  }

  return packages
}

function listWorkspaceDependencies (packageJson) {
  return Object.keys({
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {})
  }).filter(name => !!resolveWorkspacePackageRoot(name))
}

async function loadInstalledPackage (name, from) {
  const root = await realpath(await resolvePackageRoot(name, from))
  return loadPackageFromRoot(root, name)
}

async function loadPackageFromRoot (root, fallbackName) {
  const packageJson = JSON.parse(await readFile(resolvePath(root, 'package.json'), 'utf-8'))
  return {
    name: packageJson.name ?? fallbackName,
    version: packageJson.version,
    root,
    packageJson
  }
}

async function resolvePackageRoot (name, from) {
  const require = createRequire(from)

  try {
    const packageJsonPath = require.resolve(`${name}/package.json`)
    return dirname(packageJsonPath)
  } catch (error) {
    const packageJsonPath = resolvePackageJsonFromSearchPaths(require, name)
    if (packageJsonPath) {
      return dirname(packageJsonPath)
    }

    try {
      const resolvedEntry = require.resolve(name)
      return await findPackageRoot(dirname(resolvedEntry))
    } catch (resolveError) {
      const workspacePackage = resolveWorkspacePackageRoot(name)
      if (workspacePackage) {
        return workspacePackage
      }

      throw resolveError
    }
  }
}

function resolvePackageJsonFromSearchPaths (require, name) {
  const searchPaths = require.resolve.paths(name) ?? []
  const packageSegments = name.split('/')

  for (const searchPath of searchPaths) {
    const candidate = resolvePath(searchPath, ...packageSegments, 'package.json')
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

async function findPackageRoot (directory) {
  let current = directory

  while (true) {
    const candidate = resolvePath(current, 'package.json')
    if (existsSync(candidate)) {
      return current
    }

    const parent = resolvePath(current, '..')
    if (parent === current) {
      throw new Error(`Cannot determine package root for ${directory}.`)
    }

    current = parent
  }
}

function resolveWorkspacePackageRoot (name) {
  if (name !== 'wattpm' && !name.startsWith('@platformatic/')) {
    return null
  }

  const packageDirectory = name === 'wattpm' ? 'wattpm' : name.replace('@platformatic/', '')
  const candidate = resolvePath(import.meta.dirname, '..', '..', packageDirectory)

  if (existsSync(resolvePath(candidate, 'package.json'))) {
    return candidate
  }

  return null
}

async function packWorkspacePackage (pkg, tarballDirectory) {
  const { stdout } = await runCommand('pnpm', ['pack', '--pack-destination', tarballDirectory], { cwd: pkg.root })
  const tarball = stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.endsWith('.tgz'))
    .at(-1)

  if (!tarball) {
    throw new Error(`Cannot determine the tarball path for ${pkg.name}.`)
  }

  return tarball
}

async function runCommand (command, args, options) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        reject(new Error(`Command failed: ${command} ${args.join(' ')}\n${stderr || stdout}`))
      }
    })
  })
}

async function mergeDirectory (source, destination) {
  await mkdir(destination, { recursive: true })
  const entries = await readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = resolvePath(source, entry.name)
    const destinationPath = resolvePath(destination, entry.name)
    const stats = await lstat(sourcePath)

    if (stats.isSymbolicLink()) {
      await copySymlink(sourcePath, destinationPath)
      continue
    }

    if (entry.isDirectory()) {
      if (!existsSync(destinationPath)) {
        await cp(sourcePath, destinationPath, {
          recursive: true,
          dereference: false,
          preserveTimestamps: true
        })
      } else {
        await mergeDirectory(sourcePath, destinationPath)
      }
      continue
    }

    if (!existsSync(destinationPath)) {
      await cp(sourcePath, destinationPath, { dereference: false, preserveTimestamps: true })
    }
  }
}

async function copySymlink (source, destination) {
  if (existsSync(destination)) {
    return
  }

  await mkdir(dirname(destination), { recursive: true })
  await symlink(await readlink(source), destination)
}

async function cleanupBrokenSymlinks (directory) {
  if (!existsSync(directory)) {
    return
  }

  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const path = resolvePath(directory, entry.name)
    const stats = await lstat(path)

    if (!stats.isSymbolicLink()) {
      continue
    }

    try {
      await realpath(path)
    } catch (error) {
      if (error.code === 'ENOENT') {
        await rm(path, { force: true })
        continue
      }

      throw error
    }
  }
}

async function writePackageBins (packages, bundleNodeModules) {
  const binDirectory = resolvePath(bundleNodeModules, '.bin')
  await mkdir(binDirectory, { recursive: true })

  for (const pkg of packages.values()) {
    const bin = normalizeBinField(pkg.packageJson.bin, pkg.name)
    for (const [name, target] of Object.entries(bin)) {
      await writeNodeShim(resolvePath(binDirectory, name), pkg.name, target)
    }
  }
}

function normalizeBinField (bin, pkgName) {
  if (!bin) {
    return {}
  }

  if (typeof bin === 'string') {
    return { [pkgName]: bin }
  }

  return bin
}

async function writeNodeShim (destination, packageName, target) {
  const normalizedTarget = target.replaceAll('\\', '/')
  const unixScript = `#!/usr/bin/env node\nimport '../${packageName}/${normalizedTarget}'\n`

  await rm(destination, { force: true })
  await rm(`${destination}.cmd`, { force: true })
  await writeFile(destination, unixScript, 'utf-8')
  await chmod(destination, 0o755)
  await writeFile(
    `${destination}.cmd`,
    `@ECHO off\r\nnode "%~dp0\\..\\${packageName.replaceAll('/', '\\')}\\${normalizedTarget.replaceAll('/', '\\')}" %*\r\n`,
    'utf-8'
  )
}

export async function writeBundleMetadata ({
  applicationId,
  applicationConfig,
  runtimeConfig,
  bundleRoot,
  packages
}) {
  const metadataRoot = resolvePath(bundleRoot, '.platformatic')
  await mkdir(metadataRoot, { recursive: true })

  await writeFile(
    resolvePath(metadataRoot, 'manifest.json'),
    JSON.stringify(
      {
        bundleVersion: 1,
        applicationId,
        packedAt: new Date().toISOString(),
        source: {
          applicationConfig,
          runtimeConfig: runtimeConfig ?? null
        },
        platformaticVersion,
        packages: Object.fromEntries(
          [...packages.values()].map(pkg => [pkg.name, { version: pkg.version, root: pkg.root }])
        )
      },
      null,
      2
    ) + '\n',
    'utf-8'
  )

  await writeFile(
    resolvePath(metadataRoot, 'NOTICE'),
    'This directory was generated by the Next standalone pack command.\n',
    'utf-8'
  )
}

export async function ensurePortableNodeModules (bundleRoot) {
  const nodeModules = resolvePath(bundleRoot, 'node_modules')
  await assertNoExternalSymlinks(nodeModules, bundleRoot)
}

async function assertNoExternalSymlinks (directory, bundleRoot) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const path = resolvePath(directory, entry.name)
    const stats = await lstat(path)

    if (stats.isSymbolicLink()) {
      let target
      try {
        target = await realpath(path)
      } catch (error) {
        if (error.code === 'ENOENT') {
          continue
        }
        throw error
      }

      if (!target.startsWith(bundleRoot)) {
        throw new Error(`Packed bundle contains a symlink outside the bundle: ${relative(bundleRoot, path)} -> ${target}`)
      }
    } else if (entry.isDirectory()) {
      await assertNoExternalSymlinks(path, bundleRoot)
    }
  }
}
