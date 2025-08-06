process.on('exit', () => {
  process.stdout.write(' ')
  process.stdout.write('world')
})
process.stdout.write('hello')
