import { access, rm, readdir } from 'node:fs/promises'
import { execa } from 'execa'

async function fileExists (path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function dirExists (dir) {
  try {
    await access(dir)
    const files = await readdir(dir)
    return files.length > 0
  } catch (err) {
    if (err.code !== 'ENOENT') {
      await rm(dir, { force: true, recursive: true })
    }
    return false
  }
}

async function extractTarball (tarballPath, dir) {
  const child = execa('tar', ['-xf', tarballPath, '-C', dir])
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)

  await child
}

export { fileExists, dirExists, extractTarball }
