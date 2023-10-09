export default `\
type Query {
  getGraphById(id: ID!): Graph
  graphs(limit: LimitInt, offset: Int, orderBy: [GraphOrderByArguments], where: GraphWhereArguments): [Graph]
  countGraphs(where: GraphWhereArguments): graphsCount
}

type Graph {
  id: ID
  name: String
}

"""
Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
"""
scalar LimitInt

input GraphOrderByArguments {
  field: GraphOrderByField
  direction: OrderByDirection!
}

enum GraphOrderByField {
  id
  name
}

enum OrderByDirection {
  ASC
  DESC
}

input GraphWhereArguments {
  id: GraphWhereArgumentsid
  name: GraphWhereArgumentsname
  or: [GraphWhereArgumentsOr]
}

input GraphWhereArgumentsid {
  eq: ID
  neq: ID
  gt: ID
  gte: ID
  lt: ID
  lte: ID
  like: ID
  in: [ID]
  nin: [ID]
}

input GraphWhereArgumentsname {
  eq: String
  neq: String
  gt: String
  gte: String
  lt: String
  lte: String
  like: String
  in: [String]
  nin: [String]
}

input GraphWhereArgumentsOr {
  id: GraphWhereArgumentsid
  name: GraphWhereArgumentsname
}

type graphsCount {
  total: Int
}

type Mutation {
  saveGraph(input: GraphInput!): Graph
  insertGraphs(inputs: [GraphInput]!): [Graph]
  deleteGraphs(where: GraphWhereArguments): [Graph]
}

input GraphInput {
  id: ID
  name: String
}

type Subscription {
  graphSaved: Graph
  graphDeleted: GraphDeleted
}

type GraphDeleted {
  id: ID
}`
