import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'

/**
 * A utility class for programmatically manipulating .env files.
 * This is a replacement for the dotenv-tool package using native Node.js APIs.
 */
export class EnvFileTool {
  constructor (options = {}) {
    this.path = options.path
    this.env = {}
    this.loaded = false
  }

  /**
   * Load the .env file and parse its contents
   */
  async load () {
    if (!existsSync(this.path)) {
      this.env = {}
      this.loaded = true
      return
    }

    const contents = await readFile(this.path, 'utf-8')
    this.env = parseEnv(contents)
    this.loaded = true
  }

  /**
   * Save the current environment variables to the .env file
   */
  async save () {
    const lines = []
    for (const [key, value] of Object.entries(this.env)) {
      // Escape values that contain special characters
      const escapedValue = this._escapeValue(value)
      lines.push(`${key}=${escapedValue}`)
    }
    await writeFile(this.path, lines.join('\n') + '\n', 'utf-8')
  }

  /**
   * Get all environment variable keys
   */
  getKeys () {
    return Object.keys(this.env)
  }

  /**
   * Check if a key exists
   */
  hasKey (key) {
    return key in this.env
  }

  /**
   * Add a new key-value pair
   */
  addKey (key, value) {
    this.env[key] = value
  }

  /**
   * Update an existing key's value
   */
  updateKey (key, value) {
    this.env[key] = value
  }

  /**
   * Delete a key
   */
  deleteKey (key) {
    delete this.env[key]
  }

  /**
   * Get a value by key
   */
  getValue (key) {
    return this.env[key]
  }

  /**
   * Escape special characters in environment variable values
   */
  _escapeValue (value) {
    if (typeof value !== 'string') {
      return value
    }

    // If the value contains spaces, newlines, or special characters, wrap it in quotes
    if (/[\s\n\r"'#\\]/.test(value)) {
      // Escape existing quotes and backslashes
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      return `"${escaped}"`
    }

    return value
  }
}

export function createEnvFileTool (options) {
  return new EnvFileTool(options)
}
