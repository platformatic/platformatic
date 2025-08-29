import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function getArrayDifference (a, b) {
  return a.filter(element => {
    return !b.includes(element)
  })
}

export function getApplicationUrl (id) {
  return `http://${id}.plt.local`
}

export function getRuntimeTmpDir (runtimeDir) {
  const platformaticTmpDir = join(tmpdir(), 'platformatic', 'applications')
  const runtimeDirHash = createHash('md5').update(runtimeDir).digest('hex')
  return join(platformaticTmpDir, runtimeDirHash)
}
