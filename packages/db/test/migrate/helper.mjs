import { join } from 'desm'

const cliPath = join(import.meta.url, '..', '..', 'db.mjs')

function removeFileProtocol (str) {
  return str.replace('file:', '')
}

function getFixturesConfigFileLocation (filename, subdirectories = []) {
  return removeFileProtocol(join(import.meta.url, '..', '..', 'fixtures', ...subdirectories, filename))
}

export {
  cliPath,
  getFixturesConfigFileLocation
}
