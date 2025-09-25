import * as mockdata from './mock.js'
export const resolvers = {
     Query: {
          users: ()=> mockdata.users,
          branches: ()=> mockdata.branches,
          stores: ()=> mockdata.stores,
          user: (_: any, { id} : { id: number}) => 
               mockdata.users.find((u)=> u.id === Number(id)),
          store: (_: any, { id }: { id: number }) => 
               mockdata.stores.find((s)=> s.id === Number(id))
     }
}