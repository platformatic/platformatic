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
    }
  },
  additionalProperties: true // TODO remove and add proper validation for the rules
}
