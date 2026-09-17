import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { safeRemove } from '../../lib/file-system.js'

/*
  Builds a directory tree from a flat map of relative path to contents and registers its removal
  with the test context. A directory is requested by giving it a null value; every parent is
  created implicitly, so a tree is one literal.
*/
export async function createTree (t, files) {
  const root = await mkdtemp(join(tmpdir(), 'plt-v4-loader-'))

  t.after(() => safeRemove(root))

  for (const [path, contents] of Object.entries(files)) {
    const target = resolve(root, path)

    if (contents === null) {
      await mkdir(target, { recursive: true })
      continue
    }

    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents, 'utf-8')
  }

  return root
}
