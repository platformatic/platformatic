import { describeValue, isPlainObject } from './canonicalize.js'
import { InvalidConfigurationExportError } from './errors.js'

export const applicationDefinitionKey = 'module'
export const rootConfigurationKeys = ['application', 'applications', 'autoload']

// Keys that only a root configuration has. They do not decide classification — rule 2 is
// unconditional — but they make the error actionable when a root config grew a module property.
export const rootOnlyKeys = ['autoload', 'workers', 'managementApi', 'applications', 'application']

/*
  Four unconditional rules, read off the canonical snapshot and never off the raw export. Rule 1 —
  the function call — has already happened by the time this runs; what is left is total over
  objects, and everything that is not an object is refused ahead of them.

  null is the one worth spelling out: typeof null === 'object', so it would reach rule 2 as a
  property read on nothing, and the difference between a TypeError from one implementation and an
  AJV error from another is exactly the divergence these rules exist to prevent.
*/
export function classifyConfiguration (snapshot, file) {
  if (!isPlainObject(snapshot)) {
    throw new InvalidConfigurationExportError(file, describeValue(snapshot))
  }

  // Rule 2 is unconditional and carries no key-collision check: capabilities legitimately use
  // option names that are also root keys, so any collision list would misclassify valid factory
  // results. It is safe in the other direction because a v4 root config has no module key.
  if (applicationDefinitionKey in snapshot) {
    return 'application'
  }

  // Rules 3 and 4 agree on the answer; they are separate only because rule 4 is the one that says
  // an empty config file is a statement rather than an absence. Classification answers "what kind
  // of file is this", not "is it usable" — {} classifies here and is then rejected by validation.
  return 'root'
}

// Auto-wrapping happens here, on the snapshot, rather than at the point of a shape read: the whole
// point of the ordering is that nothing reads the raw export's shape.
export function autoWrapApplicationDefinition (definition) {
  return { application: { config: definition } }
}
