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
          managerId     Int? // This is the ID of the user's manager
          manager       User?        @relation("ManagerToStaff", fields: [managerId], references: [id])
          staff         User[]       @relation("ManagerToStaff")
          // Relationships
          branchesOwned Branch[]     @relation("UserBranches") // One user can own multiple branches
          storesOwned   Store[]      @relation("UserStores") // One user can own multiple stores
          storeStaff    StoreStaff[] // A user can be staff at multiple stores

          Transaction Transaction[]
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



`;
