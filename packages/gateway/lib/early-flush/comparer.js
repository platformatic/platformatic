import { nonReplayableHeaders } from './headers.js'
import { ensureSafePrefix } from './html.js'

/** Returns a byte length, without decoding or normalizing the HTML. */
export function commonPrefixLength (left, right) {
  const length = Math.min(left.byteLength, right.byteLength)
  let index = 0
  while (index < length && left[index] === right[index]) {
    index++
  }
  return index
}

/** Promotes a full-window candidate only when its size and HTTP metadata permit early flushing. */
function preparePrelude (state, options) {
  const prefix = state.candidate
  if (prefix === undefined || prefix.byteLength < options.minPreludeBytes) {
    return undefined
  }

  const latest = state.samples.peekLast()
  const status = latest.status
  if (status < 200 || status >= 300 || status === 204 || status === 205 || status === 206) {
    return undefined
  }

  // Replay the latest sample's metadata, including omissions. Only status and Content-Type
  // must agree across the entire window; other headers do not inherit older values.
  const headers = new Map(latest.headers)
  const contentType = headers.get('content-type')
  for (const sample of state.samples) {
    if (sample.status !== status || sample.headers.find(([name]) => name === 'content-type')?.[1] !== contentType) {
      return undefined
    }
  }

  // Only configured replay candidates survive. Sampling has already removed additional
  // hop-by-hop fields nominated by Connection; enforce the fixed exclusions here as well.
  for (const name of headers.keys()) {
    if (!options.headers.allowlist.includes(name) || nonReplayableHeaders.has(name)) {
      headers.delete(name)
    }
  }
  if (headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'text/html') {
    return undefined
  }

  // Cache policy is configured for the anticipated response, not learned from the app.
  headers.set('cache-control', options.headers.cacheControl)
  return { prefix, status, headers: Array.from(headers) }
}

/**
 * Mutates the supplied state inside the storage's atomic updater. Only the new HTML prefix is compared
 * with the preceding HTML prefix; the window minimum comes from cached adjacent comparisons.
 * Candidates end at safe HTML boundaries and are promoted only after size and HTTP metadata validation.
 * Options must have been validated by resolveOptions.
 */
export function compareSample (state, sample, options) {
  const samples = state.samples
  const previous = samples.peekLast()
  const comparisons = state.comparisons

  // comparisons[i] stores the HTML-safe common-prefix length of samples[i] and samples[i + 1].
  // N samples therefore have N - 1 comparisons. Zero means no shared safe boundary;
  // null means at least one sample has no HTML and the pair is not comparable.
  // Full buffers overwrite their oldest entry on push: [A, B, C] becomes [B, C, D],
  // while appending the new pair below changes [AB, BC] to [BC, CD]. Each push is O(1).
  samples.push(sample)

  // The conservative historical cap can only shrink; undefined means no cap exists yet.
  let prefixLimit = state.prefixLimit

  // HEAD and redirect samples contain no HTML prefix, so do not compare their empty
  // buffers with HTML: that would incorrectly reduce the historical prefix limit to zero.
  // Keep the last HTML prefix across these samples and compare it with the next HTML
  // response. Conservative policy then remembers differences even across redirects;
  // redirect eligibility is handled separately by redirectPolicy.
  const length =
    sample.kind === 'html' && state.lastPrefix !== undefined
      ? ensureSafePrefix(sample.prefix, commonPrefixLength(state.lastPrefix, sample.prefix))
      : undefined
  if (length !== undefined && options.prefixPolicy === 'conservative') {
    prefixLimit = Math.min(prefixLimit ?? Infinity, length)
  }

  // The first sample has no predecessor and creates no pair. Otherwise append one entry,
  // keeping null placeholders so comparisons stay aligned with adjacent sample positions.
  // Across a redirect, length may compare nonadjacent HTML samples for the historical cap;
  // that result must not be recorded as an adjacent comparison here.
  if (previous !== undefined && options.windowSize > 1) {
    comparisons.push(previous.kind === 'html' && sample.kind === 'html' ? (length ?? 0) : null)
  }

  // Inspect metadata without materializing the deque as an array. A singleton has no pairs.
  let hasRedirect = false
  let allHtml = true
  for (const entry of samples) {
    hasRedirect ||= entry.kind === 'redirect'
    allHtml &&= entry.kind === 'html'
  }
  const redirectSuspended = hasRedirect || (options.redirectPolicy === 'conservative' && state.redirectSuspended)

  // Require a full HTML-only window and permission from the redirect policy. Otherwise,
  // leave the candidate undefined, replacing any candidate from the previous state.
  let candidate
  if (samples.size === options.windowSize && !redirectSuspended && allHtml) {
    // Start with the newest prefix as an upper bound. For a singleton window there are
    // no adjacent comparisons, so its entire prefix is eligible before the historical cap.
    let candidateLength =
      comparisons.size === 0 ? ensureSafePrefix(sample.prefix, sample.prefix.byteLength) : sample.prefix.byteLength

    // Equality is transitive: if A/B share K bytes and B/C share K bytes, so do A/C.
    // Thus the minimum adjacent length, already trimmed to a safe boundary, gives a safe
    // window prefix without comparing every stored body again.
    // Null cannot occur in a consistent HTML-only window; treating it as zero fails closed.
    for (const comparison of comparisons) {
      candidateLength = Math.min(candidateLength, comparison ?? 0)
    }

    // FIFO may grow the candidate when an old difference leaves the window. Conservative
    // policy also caps it at the historical minimum: 200 current bytes with an 80-byte
    // historical limit still produce only 80 bytes, until that history is reset.
    if (options.prefixPolicy === 'conservative' && prefixLimit !== undefined) {
      candidateLength = Math.min(candidateLength, prefixLimit)
    }

    // Any sample has the same leading bytes, so use a zero-copy view of the newest one.
    // Zero safe bytes mean no candidate. Adjacent lengths already end at safe HTML boundaries;
    // Size and HTTP metadata are checked separately when promoting this candidate below.
    if (candidateLength > 0) {
      candidate = sample.prefix.subarray(0, candidateLength)
    }
  }

  state.lastPrefix = sample.kind === 'html' ? sample.prefix : state.lastPrefix
  state.prefixLimit = prefixLimit
  state.redirectSuspended = redirectSuspended
  state.candidate = candidate
  // Replace the entire prepared response atomically; a failed check revokes the old prelude.
  state.prelude = preparePrelude(state, options)
  return state
}
