import { platform } from 'node:os'
import { lt, satisfies } from 'semver'

const currentPlatform = platform()

export function checkNodeVersionForApplications () {
  const currentVersion = process.version
  const minimumVersion = '22.18.0'

  if (lt(currentVersion, minimumVersion)) {
    throw new Error(
      `Your current Node.js version is ${currentVersion}, while the minimum supported version is v${minimumVersion}. Please upgrade Node.js and try again.`
    )
  }
}

export const features = {
  node: {
    reusePort: satisfies(process.version, '^22.12.0 || ^23.1.0') && !['win32', 'darwin'].includes(currentPlatform),
    worker: {
      getHeapStatistics: satisfies(process.version, '^22.18.0')
    }
  }
}
