import semver from 'semver'
import { PackageVersionMismatchError } from './errors.js'

// Bootstrap must not depend on new foundation exports: that installed copy may predate this check.
// Keep the policy aligned with foundation's capability comparison through the shared comparison cases.
export function comparePackageVersions (expected, loaded, policy) {
  const left = semver.parse(expected ?? '')
  const right = semver.parse(loaded ?? '')

  if (!left || !right || semver.eq(left, right)) {
    return 'ok'
  }

  if (left.major !== right.major) {
    return 'error'
  }

  if (policy) {
    return policy === 'warn' ? 'warning' : 'error'
  }

  if (left.prerelease.length || right.prerelease.length) {
    return 'error'
  }

  return left.minor !== right.minor ? 'warning' : 'ok'
}

export function checkPackageVersion (reference, loaded, { policy, onWarning } = {}) {
  const level = comparePackageVersions(reference.version, loaded.version, policy)

  if (level === 'ok') {
    return
  }

  const message = `${reference.name}@${reference.version} at ${reference.path} requires matching ${loaded.name}, but loaded ${loaded.version} at ${loaded.path}. Align the installed package versions.`

  if (level === 'error') {
    throw new PackageVersionMismatchError(message)
  }

  onWarning?.({ type: 'package-version-mismatch', level, reference, loaded, message })
}
