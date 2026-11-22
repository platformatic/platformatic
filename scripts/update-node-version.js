#!/usr/bin/env node

import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const root = join(import.meta.dirname, '..')
const excludedDirectories = new Set(['.git', 'node_modules'])
const args = process.argv.slice(2)
const check = args.includes('--check')
const requestedVersion = args.find(arg => arg !== '--check')

async function getPackageJsonFiles (directory) {
  const files = []

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !excludedDirectories.has(entry.name)) {
      files.push(...(await getPackageJsonFiles(join(directory, entry.name))))
    } else if (entry.isFile() && entry.name === 'package.json') {
      files.push(join(directory, entry.name))
    }
  }

  return files
}

function isTestPackageJson (path) {
  const segments = relative(root, path).split(sep)
  return segments.some(segment => segment === 'test' || segment === 'tests' || segment === 'fixtures')
}

const rootPackageJsonPath = join(root, 'package.json')
const rootPackageJson = JSON.parse(await readFile(rootPackageJsonPath, 'utf8'))
const version = requestedVersion ?? rootPackageJson.engines?.node?.replace(/^>=/, '')

if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Specify an exact Node.js version, for example: pnpm update-node-version 24.20.0')
  process.exitCode = 1
} else {
  const expected = `>=${version}`
  const mismatches = []
  let updated = 0

  for (const path of (await getPackageJsonFiles(root)).sort()) {
    const source = await readFile(path, 'utf8')
    const packageJson = JSON.parse(source)
    const excluded = isTestPackageJson(path)
    const matchesPolicy = excluded ? packageJson.engines?.node === undefined : packageJson.engines?.node === expected

    if (matchesPolicy) {
      continue
    }

    if (check) {
      mismatches.push(path.slice(root.length + 1))
      continue
    }

    if (excluded) {
      delete packageJson.engines.node
      if (Object.keys(packageJson.engines).length === 0) {
        delete packageJson.engines
      }
    } else {
      packageJson.engines = { ...packageJson.engines, node: expected }
    }

    const indentation = source.match(/\n([\t ]+)"/)?.[1] ?? '  '
    const trailingNewline = source.endsWith('\n') ? '\n' : ''
    await writeFile(path, JSON.stringify(packageJson, null, indentation) + trailingNewline)
    updated++
  }

  if (mismatches.length > 0) {
    console.error('The following package.json files do not match the Node.js engine policy:')
    for (const path of mismatches) {
      console.error(`- ${path}`)
    }
    process.exitCode = 1
  } else if (!check) {
    console.log(`Updated ${updated} package.json files to match the Node.js engine policy (${expected}).`)
  }
}
