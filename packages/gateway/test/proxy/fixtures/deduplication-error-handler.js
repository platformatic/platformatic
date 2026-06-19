export function handler (_request, reply, _dest, options) {
  return options.deduplicateError(reply, { error: new Error('custom failure') })
}
