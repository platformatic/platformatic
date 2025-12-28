export const AuthSchema = {
  $id: '/BasegraphAuth',
  type: 'object',
  properties: {
    adminSecret: {
      type: 'string',
      description: 'The password should be used to access routes under /_admin prefix.'
    },
    roleKey: {
      type: 'string',
      description: 'The key in the user object that contains the roles.'
    },
    rolePath: {
      type: 'string',
      description: 'The path in the user object that contains the roles.'
    },
    roleMergeStrategy: {
      type: 'string',
      enum: ['first-match', 'most-permissive'],
      default: 'first-match',
      description: 'Strategy for merging permissions when a user has multiple roles. "first-match" returns the first matching rule (default). "most-permissive" merges all matching rules, where truthy permissions win over falsy ones.'
    }
  },
  additionalProperties: true // TODO remove and add proper validation for the rules
}
