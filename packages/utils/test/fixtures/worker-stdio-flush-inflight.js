const { ensureFlushedWorkerStdio } = require('../..')

ensureFlushedWorkerStdio()

// Make sure an accicental second call doesn't break anything
ensureFlushedWorkerStdio()

process.stderr.write('hello')
process.stderr.write(' ')
process.stderr.write('world\n')
process.exit(0)
