import { spawn } from 'node:child_process'
import { sync } from 'glob'

const testFiles = sync('test/**/*.test.{js,mjs}')

spawn(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
  env: { ...process.env }
})
  .on('exit', process.exit)
