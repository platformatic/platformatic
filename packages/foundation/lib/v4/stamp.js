import { describeValue, isPlainObject } from './canonicalize.js'
import { InvalidSchemaStampError, LegacySchemaStampError } from './errors.js'

const stampPattern = /^https:\/\/schemas\.platformatic\.dev\/(?<module>.+)\/(?<major>\d+)\.\d+\.\d+\.json$/

/*
  The stamped `$schema` property is mandatory for machine writers of the plain-object form — pack,
  install and deployment tooling, which have no import to identify themselves with. A hand-written
  configuration identifies itself by importing what it uses and carries none.

  The loader reads it for **version detection only**, never module selection: `module` selects the
  capability, and a URL that disagreed with it would be a second, quieter answer to a question that
  already has one. It is stripped before validation, because the v4 schema does not admit it and
  without the strip every machine-generated configuration would fail.

  A stale v3 URL refuses rather than being ignored. It is the one signal that a file was generated
  against a schema whose meaning has since changed, and this is exactly the class of file — machine
  written, nobody reading it — where a silent reinterpretation goes unnoticed.
*/
export function readAndStripSchemaStamp (config, path) {
  if (!isPlainObject(config) || !('$schema' in config)) {
    return null
  }

  const stamp = config.$schema
  delete config.$schema

  if (typeof stamp !== 'string') {
    throw new InvalidSchemaStampError(path, describeValue(stamp))
  }

  const match = stampPattern.exec(stamp)

  // A URL this loader does not recognize is not its to interpret: an editor pointed at a
  // hand-written JSON Schema is a legitimate thing to have, and refusing it would be inventing a
  // rule the format never stated.
  if (!match) {
    return stamp
  }

  if (Number(match.groups.major) < 4) {
    throw new LegacySchemaStampError(path, stamp)
  }

  return stamp
}
