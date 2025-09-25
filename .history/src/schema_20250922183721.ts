import { gql } from "graphql-tag";
export const typeDefs = gql`
  enum Role {
    ADMIN
    MANAGER
    STAFF
    CASHIER
  }
  enum OutletType {
    retail
    wholesale
    service
  }
  type User {
    id: ID!
    fullname: String!
    username: String!
    email: String!
    role: Role!
    branchesOwned: [Branch!] # <-- add this
    storesOwned: [Store!]
    password: String!
    profilePhoto: String
  }
  type Branch {
    id: ID!
    name: String!
    address: String!
    phone: String
    isActive: Boolean!
    owner: User!
    stores: [Store!]
  }

  type Store {
    id: ID!
    name: String!
    address: String!
    phone: String
    code: String!
    governmentTax: Float
    serviceCharge: Float
    outletType: OutletType!
    isActive: Boolean!
    owner: User!
    branch: Branch!
  }
  
  type AuthPayload {
    user: User!
    token: String!
    refresh_token: String!
  }
  # QUERY
  type Query {
    users: [User!]!
    user(id: ID!): User
    branches: [Branch!]!
    branch(id: ID!): Branch
    stores: [Store!]!
    store(id: ID!): Store
  }
  # INPUTS
  input CreateUserInput {
    fullname: String!
    username: String!
    email: String!
    password: String!
    role: Role
  }
  input LoginInput {
    username: String!
    password: String!
  }
  type Mutation {
    createUser(data: CreateUserInput!): User!
    deleteUser(id: ID!): User
  }
`;
