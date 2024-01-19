import { access, mkdir } from 'fs/promises'
import { resolve } from 'path'

export async function isFileAccessible (filename, directory) {
  try {
    const filePath = directory ? resolve(directory, filename) : filename
    await access(filePath)
    return true
  } catch (err) {
    return false
  }
}

export async function safeMkdir (dir) {
  try {
    await mkdir(dir, { recursive: true })
  } catch (err) {
    // do nothing
  }
}
