class MigrateError extends Error {
  constructor (message) {
    super(message)
    this.name = 'MigrateError'
  }
}

class SeedError extends Error {
  constructor (message) {
    super(message)
    this.name = 'SeedError'
  }
}

export {
  MigrateError,
  SeedError
}
