import { resolve } from 'path'

const cliPath = resolve(import.meta.dirname, '../../bin/plt-db.mjs')

function removeFileProtocol (str) {
  return str.replace('file:', '')
}

function getFixturesConfigFileLocation (filename, subdirectories = []) {
  return removeFileProtocol(resolve(import.meta.dirname, '../cli/fixtures', ...subdirectories, filename))
}

export { cliPath, getFixturesConfigFileLocation }
