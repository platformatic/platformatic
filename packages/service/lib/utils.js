import { access, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

let _isDocker

export async function isDocker () {
  async function hasDockerEnv () {
    try {
      await stat('/.dockerenv')
      return true
    } catch {
      return false
    }
  }

  async function hasDockerCGroup () {
    try {
      return (await readFile('/proc/self/cgroup', 'utf8')).includes('docker')
    } catch {
      return false
    }
  }

  if (_isDocker === undefined) {
    _isDocker = (await hasDockerEnv()) || (await hasDockerCGroup())
  }

  return _isDocker
}

export async function isFileAccessible (filename, directory) {
  try {
    const filePath = directory ? resolve(directory, filename) : filename
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}

export async function sanitizeHTTPSArgument (arg) {
  if (typeof arg === 'string') {
    return arg
  } else if (!Array.isArray(arg)) {
    return readFile(arg.path)
  }

  const sanitized = []
  for (const item of arg) {
    sanitized.push(typeof item === 'string' ? item : await readFile(item.path))
  }

  return sanitized
}
