import { access } from 'node:fs/promises'

async function fileExists (path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export { fileExists }
