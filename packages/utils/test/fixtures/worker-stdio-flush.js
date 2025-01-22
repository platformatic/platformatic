const { ensureFlushedWorkerStdio } = require('../..')

ensureFlushedWorkerStdio()

// Make sure an accicental second call doesn't break anything
ensureFlushedWorkerStdio()

process.on('exit', () => {
  process.stdout.write(' ')
  process.stdout.write('world')
})
process.stdout.write('hello')
