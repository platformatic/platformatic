'use strict'

const dogs = [
  { id: 1, name: 'Buddy' },
  { id: 2, name: 'Duke' },
  { id: 3, name: 'Bella' }
]

module.exports = {
  schema: `
  type Query {
    dogs: [Dog]!
    dog(id: ID!): Dog
  }
  
  type Mutation {
    createDog(dog: CreateDogInput!): Dog!
    updateDog(id: ID!, dog: UpdateDogInput!): Dog
    deleteDog(id: ID!): ID
  }
  
  type Dog {
    id: ID!
    name: String
  }
  
  input CreateDogInput {
    name: String!
  }

  input UpdateDogInput {
    name: String!
  }
  `,
  resolvers: {
    Query: {
      dog: (_, { id }) => dogs.find(d => d.id === id),
      dogs: () => dogs
    },
    Mutation: {
      createDog: (_, { dog }) => {
        dogs.push({ id: dogs.length, name: dog.name })
        return dog
      },
      updateDog: (_, { id, dog }) => {
        const d = dogs.find(d => d.id === id)
        if (!d) return
        d.name = dog.name
        return d
      },
      deleteDog: (_, { id, dog }) => {
        const i = dogs.findIndex(d => d.id === id)
        if (i !== -1) {
          dogs.splice(i, 1)
        }
        return id
      }
    }
  }
}
