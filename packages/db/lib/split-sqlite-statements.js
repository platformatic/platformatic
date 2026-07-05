const TRANSACTION_MODIFIERS = new Set(['TRANSACTION', 'DEFERRED', 'IMMEDIATE', 'EXCLUSIVE'])

function nextWord (script, from) {
  let i = from
  while (i < script.length && /\s/.test(script[i])) {
    i++
  }
  let j = i
  while (j < script.length && /[A-Za-z_0-9]/.test(script[j])) {
    j++
  }
  return { word: script.slice(i, j).toUpperCase(), index: i }
}

/**
 * Split a SQLite script into single statements.
 *
 * Generic SQL splitters break on the semicolons inside CREATE TRIGGER
 * BEGIN ... END bodies, so this one tracks strings, quoted identifiers,
 * comments and BEGIN/CASE ... END nesting and only splits on top level
 * semicolons.
 */
export function splitSQLiteStatements (script) {
  const statements = []
  let current = ''
  let depth = 0
  let i = 0
  const len = script.length

  while (i < len) {
    const ch = script[i]
    const two = script.slice(i, i + 2)

    // Strings and quoted identifiers: quotes are escaped by doubling them
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      current += ch
      i++
      while (i < len) {
        current += script[i]
        if (script[i] === quote) {
          if (script[i + 1] === quote) {
            current += script[i + 1]
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }

    // Bracket quoted identifiers
    if (ch === '[') {
      while (i < len && script[i] !== ']') {
        current += script[i]
        i++
      }
      if (i < len) {
        current += ']'
        i++
      }
      continue
    }

    // Line comments
    if (two === '--') {
      while (i < len && script[i] !== '\n') {
        current += script[i]
        i++
      }
      continue
    }

    // Block comments
    if (two === '/*') {
      while (i < len && script.slice(i, i + 2) !== '*/') {
        current += script[i]
        i++
      }
      if (i < len) {
        current += '*/'
        i += 2
      }
      continue
    }

    // Keywords: track BEGIN/CASE ... END nesting
    if (/[A-Za-z_]/.test(ch)) {
      let j = i
      while (j < len && /[A-Za-z_0-9]/.test(script[j])) {
        j++
      }
      const word = script.slice(i, j).toUpperCase()

      if (word === 'BEGIN') {
        // BEGIN [TRANSACTION|DEFERRED|IMMEDIATE|EXCLUSIVE|;] starts a
        // transaction, not a block
        const following = nextWord(script, j)
        if (script[following.index] !== ';' && !TRANSACTION_MODIFIERS.has(following.word)) {
          depth++
        }
      } else if (word === 'CASE') {
        depth++
      } else if (word === 'END') {
        depth = Math.max(0, depth - 1)
      }

      current += script.slice(i, j)
      i = j
      continue
    }

    if (ch === ';' && depth === 0) {
      statements.push(current)
      current = ''
      i++
      continue
    }

    current += ch
    i++
  }
  statements.push(current)

  return statements
    .map(statement => statement.trim())
    .filter(statement => {
      // Skip empty chunks and comment only chunks
      const withoutComments = statement
        .replace(/--[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim()
      return withoutComments.length > 0
    })
}
