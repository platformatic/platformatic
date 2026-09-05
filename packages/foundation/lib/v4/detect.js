import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { hasJavascriptFiles } from '../file-system.js'
import { AmbiguousCapabilityError, CapabilityNotDetectedError } from './errors.js'

/*
  The table is enumerated rather than pattern-matched on @platformatic/*, so companion packages
  like @platformatic/globals — which @platformatic/node's own generator writes alongside it —
  cannot trip the ambiguity error, and the out-of-tree capabilities already in v3's table have a
  defined place. A capability outside the table, which is every third-party one, is never inferred:
  those applications declare an explicit config file.
*/
export const capabilityPackages = [
  '@platformatic/node',
  '@platformatic/service',
  '@platformatic/db',
  '@platformatic/gateway',
  '@platformatic/next',
  '@platformatic/astro',
  '@platformatic/vite',
  '@platformatic/remix',
  '@platformatic/nest',
  '@platformatic/nitro',
  '@platformatic/nuxt',
  '@platformatic/react-router',
  '@platformatic/tanstack',
  '@platformatic/php',
  '@platformatic/ai-warp',
  '@platformatic/pg-hooks',
  '@platformatic/rabbitmq-hooks',
  '@platformatic/kafka-hooks'
]

export const capabilityAliases = { '@platformatic/composer': '@platformatic/gateway' }

// Fallback only, and ordered: Nitro applications often use Vite, so Nitro is checked first, and
// Vite comes last amongst the frontend frameworks for the same reason.
export const frameworkDependencies = [
  { capability: '@platformatic/nest', dependencies: ['@nestjs/core'] },
  { capability: '@platformatic/next', dependencies: ['next'] },
  { capability: '@platformatic/remix', dependencies: ['@remix-run/dev'] },
  { capability: '@platformatic/astro', dependencies: ['astro'] },
  { capability: '@platformatic/react-router', dependencies: ['@react-router/dev'] },
  { capability: '@platformatic/nuxt', dependencies: ['nuxt'] },
  { capability: '@platformatic/tanstack', dependencies: ['@tanstack/react-start'] },
  { capability: '@platformatic/nitro', dependencies: ['nitro', 'nitropack'] },
  { capability: '@platformatic/vite', dependencies: ['vite'] }
]

export function hasDirectDependency (packageJson, dependency) {
  return Boolean(packageJson?.dependencies?.[dependency] ?? packageJson?.devDependencies?.[dependency])
}

async function readPackageJson (directory) {
  try {
    return JSON.parse(await readFile(join(directory, 'package.json'), 'utf-8'))
  } catch {
    return {}
  }
}

/*
  One deterministic run against the application's package.json, for an entry with neither an inline
  config nor a per-app file.

  The order inverts v3, which checked framework dependencies first and reached @platformatic/node
  only through the terminal fallback. Under that order a generated Node application that later
  added Vite as unrelated tooling would silently switch capability on its next boot. Because
  scaffolding always adds the chosen capability to the application's dependencies, this order
  provably reconstructs the wizard's choice — which is what makes the single-app zero-config case
  sound. Multi-app projects never rely on it.
*/
export async function detectCapability (directory, { id, packageJson } = {}) {
  packageJson ??= await readPackageJson(directory)

  const declared = new Set()

  for (const [alias, canonical] of Object.entries(capabilityAliases)) {
    if (hasDirectDependency(packageJson, alias)) {
      declared.add(canonical)
    }
  }

  for (const capability of capabilityPackages) {
    if (hasDirectDependency(packageJson, capability)) {
      declared.add(capability)
    }
  }

  if (declared.size > 1) {
    throw new AmbiguousCapabilityError(id ?? directory, [...declared].sort().join(', '))
  }

  if (declared.size === 1) {
    return { capability: [...declared][0], source: 'dependency' }
  }

  for (const { capability, dependencies } of frameworkDependencies) {
    if (dependencies.some(dependency => hasDirectDependency(packageJson, dependency))) {
      return { capability, source: 'framework' }
    }
  }

  // The terminal rule keeps v3's zero-config floor: a directory containing JavaScript or
  // TypeScript sources that matched nothing else is a generic Node application. A directory with
  // none is an error naming the application — there is no generic fallback beyond this one.
  if (await hasJavascriptFiles(directory)) {
    return { capability: '@platformatic/node', source: 'terminal' }
  }

  throw new CapabilityNotDetectedError(id ?? directory, directory)
}
