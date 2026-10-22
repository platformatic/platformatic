const ID = '[A-Za-z_$][\\w$]*'
const ARROW = `(?:\\([^()]*\\)|${ID})\\s*(?::[^=]+?)?=>`
const FUNCTION_VALUE = `(?:async\\s+)?(?:function\\b|${ARROW}|\\(\\s*$)`

// Minifiers use the shortest available identifiers: names longer than this
// are assumed to be the original ones
const MAX_MINIFIED_NAME_LENGTH = 3
const MAX_LINE_LENGTH = 2000

const RESERVED = new Set([
  'async', 'await', 'case', 'catch', 'class', 'const', 'default', 'delete', 'do', 'else', 'export', 'extends',
  'false', 'finally', 'for', 'function', 'get', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'null', 'of',
  'return', 'set', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined', 'var',
  'void', 'while', 'with', 'yield'
])

const IDENTIFIER_AT = new RegExp(`^(${ID})`)
// function name(, async function name(, export default function* name(
const FUNCTION_AT = new RegExp(`^(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s*\\*?\\s*(${ID})`)
// const name = function, export const name = async () =>
const DECLARATION_AT = new RegExp(`^(?:export\\s+)?(?:const|let|var)\\s+(${ID})\\s*(?::[^=]+)?=\\s*${FUNCTION_VALUE}`)
// name = function, name: async () =>
const ASSIGNMENT_AT = new RegExp(`^(${ID})\\s*[:=]\\s*${FUNCTION_VALUE}`)
// name(, async name(, static *name(
const METHOD_AT = new RegExp(`^(?:(?:async|static|get|set)\\s+)*\\*?\\s*(${ID})\\s*\\(`)
const ANONYMOUS_AT = new RegExp(`^(?:async\\s*)?(?:function\\b|\\(|${ID}\\s*=>)`)
const FUNCTION_KEYWORD_BEFORE = /(?:^|[^\w$.])function\s*\*?\s*$/
const TARGET_BEFORE = new RegExp(`(${ID})\\s*[:=]\\s*(?:async\\s+)?$`)
const METHOD_CONTEXT_BEFORE = /(?:^|[{,;*]|\b(?:async|static|get|set))\s*$/

function validName (name) {
  return RESERVED.has(name) ? null : name
}

/**
 * Whether a function name reported by V8 carries no information about the
 * original function: it is either missing or short enough to be the output
 * of a minifier.
 */
export function isMinifiedName (name) {
  // Anonymous functions are reported as (anonymous) or (anonymous:L#1:C#1)
  if (!name || name.startsWith('(anonymous')) {
    return true
  }

  return name.length <= MAX_MINIFIED_NAME_LENGTH
}

/**
 * Extract the name of the function defined at the given column of an original
 * source line. V8 reports the position of the function parameters, which
 * bundlers map to the function keyword, to its name or to the beginning of
 * the statement: the name is searched around the column rather than in the
 * whole line, so that a callback is not named after the statement it is in.
 *
 * @param {string} line - The original source line
 * @param {number} column - The 0-based column in the line
 * @returns {string|null} The function name or null if it cannot be determined
 */
export function extractFunctionName (line, column = 0) {
  if (typeof line !== 'string' || line.length === 0 || line.length > MAX_LINE_LENGTH) {
    return null
  }

  if (!Number.isInteger(column) || column < 0 || column > line.length) {
    column = 0
  }

  const before = line.slice(0, column)
  const rest = line.slice(column).trimStart()

  let match = rest.match(FUNCTION_AT)
  if (match) {
    return validName(match[1])
  }

  match = rest.match(DECLARATION_AT)
  if (match) {
    return validName(match[1])
  }

  if (FUNCTION_KEYWORD_BEFORE.test(before)) {
    match = rest.match(IDENTIFIER_AT)
    return match ? validName(match[1]) : null
  }

  match = rest.match(ASSIGNMENT_AT)
  if (match) {
    return validName(match[1])
  }

  if (ANONYMOUS_AT.test(rest)) {
    match = before.match(TARGET_BEFORE)
    return match ? validName(match[1]) : null
  }

  if (METHOD_CONTEXT_BEFORE.test(before)) {
    match = rest.match(METHOD_AT)
    if (match) {
      return validName(match[1])
    }
  }

  return null
}
