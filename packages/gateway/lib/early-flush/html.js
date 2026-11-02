import { SAXParser } from 'parse5-sax-parser'

const textElements = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'noscript',
  'plaintext'
])

/*
 Retreats a shared byte-prefix length to a conservative HTML streaming boundary.

 Only complete start tags, end tags, comments and doctypes outside text-only and
 foreign-content elements advance the boundary. Ordinary elements may remain open:
 `<html><head>` is eligible, but `<html><head><script>unfinished` retreats to `<head>`.
 Text alone never advances the boundary, even when its characters are complete.

 Tokenization distinguishes real markup from tag-like sequences inside quoted attributes,
 comments and raw text. It runs without EOF recovery, which could otherwise emit an
 unfinished token as if the sampled prefix were the end of the actual document.

 This validates a cut position, not document validity or replay eligibility. It does not
 establish that content is request-independent, validate response headers/status, or enforce
 minPreludeBytes. The caller must perform those checks before flushing.
 Tokenization and offset conversion are linear in the inspected prefix length. Each call
 creates a tokenizer and decoded string, but no DOM/AST or rewritten HTML buffer.
*/
export function ensureSafePrefix (prefix, length) {
  if (length <= 0) {
    return 0
  }

  let text
  try {
    // Streaming decode withholds an incomplete trailing character; preserve a BOM in offsets.
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(prefix.subarray(0, length), {
      stream: true
    })
  } catch {
    // Invalid UTF-8 cannot be mapped reliably back from parser offsets to original bytes.
    return 0
  }

  const parser = new SAXParser({ sourceCodeLocationInfo: true })
  // safeOffset is a UTF-16 source position. Keep it unchanged while a special context is
  // open so an unfinished element falls back to the boundary preceding its opening tag.
  let safeOffset = 0
  // Name of the open text-only element. Blocks candidate boundaries until its matching
  // closing tag, preventing a cut inside script, style, RCDATA or other special text.
  let textElement

  // Number of open SVG/MathML regions. Blocks boundaries inside foreign content until
  // all nested regions close; self-closing SVG/MathML tags do not increase this depth.
  let foreignDepth = 0

  parser.on('startTag', token => {
    if (textElement !== undefined) {
      return
    }
    // Treat SVG and MathML conservatively as whole regions rather than selecting boundaries
    // within foreign content. Nested regions defer advancement until the outer region closes.
    if (token.tagName === 'svg' || token.tagName === 'math') {
      if (!token.selfClosing) {
        foreignDepth++
      }
      if (foreignDepth === 0) {
        safeOffset = token.sourceCodeLocation.endOffset
      }
      return
    }
    if (foreignDepth > 0) {
      return
    }
    if (textElements.has(token.tagName)) {
      // In HTML, a self-closing slash does not close script/style and similar elements.
      textElement = token.tagName
      return
    }
    safeOffset = token.sourceCodeLocation.endOffset
  })

  parser.on('endTag', token => {
    // Only the matching closing token leaves a text-only context. parse5 handles embedded
    // tag-like text and case normalization; plaintext never produces a matching closing token.
    if (textElement !== undefined) {
      if (token.tagName !== textElement) {
        return
      }
      textElement = undefined
    }
    if (foreignDepth > 0) {
      if (token.tagName === 'svg' || token.tagName === 'math') {
        foreignDepth--
      }
      if (foreignDepth > 0) {
        return
      }
    }
    safeOffset = token.sourceCodeLocation.endOffset
  })

  // Completed comments and doctypes are standalone boundaries outside blocked contexts.
  // No text listener is registered: trailing text or entities retain the preceding boundary.
  parser.on('comment', token => {
    if (textElement === undefined && foreignDepth === 0) {
      safeOffset = token.sourceCodeLocation.endOffset
    }
  })
  parser.on('doctype', token => {
    if (textElement === undefined && foreignDepth === 0) {
      safeOffset = token.sourceCodeLocation.endOffset
    }
  })

  // write() tokenizes synchronously. Stop before end() to suppress EOF repair of partial markup.
  parser.write(text)
  parser.stop()
  parser.end()

  // parse5 offsets count UTF-16 code units, whereas the comparer and stream use byte offsets.
  // Measure the original decoded source, not token values: entities, CRLF and attribute
  // spelling may be normalized in token payloads and would give incorrect byte positions.
  return Buffer.byteLength(text.slice(0, safeOffset), 'utf8')
}
