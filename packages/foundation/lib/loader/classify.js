import { describeValue, isPlainObject } from './canonicalize.js'
import { InvalidConfigurationExportError } from './errors.js'

export const applicationDefinitionKey = 'module'
export const rootConfigurationKeys = ['application', 'applications', 'autoload']

// Keys that only a root configuration has. They do not decide classification — rule 2 is
// unconditional — but they make the error actionable when a root config grew a module property.
export const rootOnlyKeys = ['autoload', 'workers', 'managementApi', 'applications', 'application']

/*
  The four classification rules, in order. They are read off the canonical snapshot and never off
  the raw export:

    1. A function export is called once with the configuration context and its resolved value is
       classified by the rules below. This happens in the evaluation pipeline before this runs, so
       what reaches here is always the resolved object.
    2. An object with a `module` key is an application definition (a capability factory result, or a
       hand-written per-application config).
    3. An object with a root key (`application`, `applications` or `autoload`) is a root config.
    4. Any other object — including an empty one — is a root config: an empty file is a statement,
       not an absence.

  Rules 3 and 4 return the same answer, so the code distinguishes only rule 2 from the rest.
  Everything that is not an object is refused ahead of them.

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
  // results. It is safe in the other direction because a root config has no module key.
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
