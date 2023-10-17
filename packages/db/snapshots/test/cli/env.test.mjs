'use strict'

export default `\
type Query {
  getPageById(id: ID!): Page
  pages(limit: LimitInt, offset: Int, orderBy: [PageOrderByArguments], where: PageWhereArguments): [Page]
  countPages(where: PageWhereArguments): pagesCount
}

type Page {
  id: ID
  title: String
}

"""
Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown
"""
scalar LimitInt

input PageOrderByArguments {
  field: PageOrderByField
  direction: OrderByDirection!
}

enum PageOrderByField {
  id
  title
}

enum OrderByDirection {
  ASC
  DESC
}

input PageWhereArguments {
  id: PageWhereArgumentsid
  title: PageWhereArgumentstitle
  or: [PageWhereArgumentsOr]
}

input PageWhereArgumentsid {
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

input PageWhereArgumentstitle {
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

input PageWhereArgumentsOr {
  id: PageWhereArgumentsid
  title: PageWhereArgumentstitle
}

type pagesCount {
  total: Int
}

type Mutation {
  savePage(input: PageInput!): Page
  insertPages(inputs: [PageInput]!): [Page]
  deletePages(where: PageWhereArguments): [Page]
}

input PageInput {
  id: ID
  title: String
}

type Subscription {
  pageSaved: Page
  pageDeleted: PageDeleted
}

type PageDeleted {
  id: ID
}`
