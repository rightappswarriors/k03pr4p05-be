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
     type User{
          id: ID!,
          fullname: string!
          username: string!
          email: string!    
          role:  Role!
          password: string!
          createdAt: DateTime
          profilePhoto:  string
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
     input CreateUserInput {
          fullname: String!
          username: String!
          email: String!
          password: String!
          role: Role
     }
     input LoginInput {
          username: string!
          password: string!
     }
     type AuthPayload {
          user: User!
          token: string!
          refresh_token: string!
     }
     type Query {
          users: [User!]!
          user(id: ID!): user
     }

     type Mutation {
          createUser(data: CreateUserInput!): User!
          deleteUser(id: ID!): User
     }     



`;
