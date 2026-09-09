// The light /schema subpath, part of the v4 capability contract. It carries the schema and the
// package-level metadata main-side preparation needs, and imports nothing that would pull the
// capability's implementation in with it — boot resolves this rather than the package entry.
//
// Light is a statement about import cost, never about safety: this executes in the main process
// with full privileges, like any capability code.
export * from './lib/schema.js'
