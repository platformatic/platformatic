import { resolve } from 'node:path'

export function getFixturesConfigFileLocation (filename, subdirectories = []) {
  return resolve(import.meta.dirname, '../cli/fixtures', ...subdirectories, filename).replace('file:', '')
}
