/**
 * Creates a logger that captures all output for testing purposes
 */
export function createCapturingLogger () {
  let capturedOutput = ''
  const logger = {
    info: (msg) => { capturedOutput += msg + '\n' },
    warn: (msg) => { capturedOutput += msg + '\n' },
    debug: () => {},
    trace: () => {},
    error: (msg) => { capturedOutput += msg + '\n' },
    fatal: (msg) => { capturedOutput += msg + '\n' }
  }
  logger.getCaptured = () => capturedOutput
  return logger
}

/**
 * Creates a test context with common utilities
 *
 * Note: includes a minimal parseArgs stub since some command functions
 * (like applyMigrations) expect it, even when called with empty args arrays
 */
export function createTestContext () {
  return {
    parseArgs () {
      // Minimal stub for command functions that expect parseArgs in context
      // Returns empty values since most tests pass empty args arrays
      return { values: {}, positionals: [] }
    },
    colorette: {
      bold (str) {
        return str
      }
    },
    logFatalError (logger, ...args) {
      if (logger.fatal) logger.fatal(...args)
      return false
    }
  }
}

/**
 * Creates a logger that throws errors on error/fatal messages
 */
export function createThrowingLogger () {
  return {
    info: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    error: (msg) => { throw new Error(msg) },
    fatal: (msg) => { throw new Error(msg) }
  }
}

/**
 * Utility for capturing console.log output during tests
 */
export function withCapturedConsole (testFn) {
  return async (...args) => {
    let capturedOutput = ''
    const originalConsoleLog = console.log
    console.log = (msg) => { capturedOutput += msg }

    try {
      const result = await testFn(capturedOutput, ...args)
      return result
    } finally {
      console.log = originalConsoleLog
    }
  }
}

/**
 * Utility for managing environment variables during tests
 */
export function withEnvironmentVariables (envVars, testFn) {
  return async (...args) => {
    const originalEnv = {}

    // Save original values
    for (const [key] of Object.entries(envVars)) {
      originalEnv[key] = process.env[key]
    }

    // Set test values
    Object.assign(process.env, envVars)

    try {
      return await testFn(...args)
    } finally {
      // Restore original values
      for (const [key, originalValue] of Object.entries(originalEnv)) {
        if (originalValue !== undefined) {
          process.env[key] = originalValue
        } else {
          delete process.env[key]
        }
      }
    }
  }
}

/**
 * Utility for managing working directory during tests
 */
export function withWorkingDirectory (newCwd, testFn) {
  return async (...args) => {
    const originalCwd = process.cwd()

    try {
      process.chdir(newCwd)
      return await testFn(...args)
    } finally {
      process.chdir(originalCwd)
    }
  }
}

/**
 * Combined utility for console capture, environment variables, and working directory
 */
export function withTestEnvironment (options, testFn) {
  return async (...args) => {
    const { envVars, workingDirectory, captureConsole } = options

    // Setup console capture
    let capturedOutput = ''
    const originalConsoleLog = captureConsole ? console.log : null
    if (captureConsole) {
      console.log = (msg) => { capturedOutput += msg }
    }

    // Setup environment variables
    const originalEnv = {}
    if (envVars) {
      for (const [key] of Object.entries(envVars)) {
        originalEnv[key] = process.env[key]
      }
      Object.assign(process.env, envVars)
    }

    // Setup working directory
    const originalCwd = workingDirectory ? process.cwd() : null
    if (workingDirectory) {
      process.chdir(workingDirectory)
    }

    try {
      if (captureConsole) {
        // Create a capturedOutput object that can be read/written
        const captureObj = {
          get: () => capturedOutput,
          add: (msg) => { capturedOutput += msg }
        }
        return await testFn(captureObj, ...args)
      } else {
        return await testFn(...args)
      }
    } finally {
      // Restore console
      if (originalConsoleLog) {
        console.log = originalConsoleLog
      }

      // Restore environment variables
      if (envVars) {
        for (const [key, originalValue] of Object.entries(originalEnv)) {
          if (originalValue !== undefined) {
            process.env[key] = originalValue
          } else {
            delete process.env[key]
          }
        }
      }

      // Restore working directory
      if (originalCwd) {
        process.chdir(originalCwd)
      }
    }
  }
}
