import path, { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import json5 from 'json5'

export async function isServiceBuildable (serviceRoot, config) {
  if (config?.application?.commands?.build) {
    return true
  }

  // Check if package.json exists and has a build command
  const packageJsonPath = join(serviceRoot, 'package.json')

  try {
    // File exists, try to read and parse it
    try {
      const content = await readFile(packageJsonPath, 'utf8')
      const packageJson = JSON.parse(content)
      if (packageJson.scripts && packageJson.scripts.build) {
        return true
      }
    } catch {
      // Invalid JSON or other read error
    }
  } catch {
    // package.json doesn't exist
  }

  return false
}

export async function getTsconfig (root, config) {
  try {
    const tsConfigPath = config?.plugins?.typescript?.tsConfig || path.resolve(root, 'tsconfig.json')
    const tsConfig = json5.parse(await readFile(tsConfigPath, 'utf8'))

    return Object.assign(tsConfig.compilerOptions, config?.plugins?.typescript)
  } catch {
    return null
  }
}

export function ignoreDirs (outDir, watchOptionsExcludeDirectories) {
  const ignore = new Set()

  if (watchOptionsExcludeDirectories) {
    for (const dir of watchOptionsExcludeDirectories) {
      ignore.add(dir)
    }
  }

  if (outDir) {
    ignore.add(outDir)
    if (!outDir.endsWith('/**')) {
      ignore.add(`${outDir}/**`)
    }
  }

  if (ignore.size === 0) {
    return ['dist', 'dist/**']
  }

  return Array.from(ignore)
}
