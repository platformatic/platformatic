import { resolve } from 'node:path'

export const cliPath = resolve(import.meta.dirname, '../cli/executables/cli.js')

export function getFixturesConfigFileLocation (filename, subdirectories = []) {
  return resolve(import.meta.dirname, '../cli/fixtures', ...subdirectories, filename).replace('file:', '')
}
