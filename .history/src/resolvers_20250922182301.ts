import * as mockdata from "./mock.js";
export const resolvers = {
  Query: {
    users: () => mockdata.users,
    branches: () => mockdata.branches,
    stores: () => mockdata.stores,
    user: (_: any, { id }: { id: number }) =>
      mockdata.users.find((u) => u.id === Number(id)),
    store: (_: any, { id }: { id: number }) =>
      mockdata.stores.find((s) => s.id === Number(id)),
  },
  Mutation: {
    createUser: (_: any, { data }: any) => {
      const newUser = { id: mockdata.users.length + 1, ...data };
      mockdata.users.push(newUser);
      return newUser;
    },
    deleteUser: (_: any, { id }: { id: number }) => {
      const index = mockdata.users.findIndex((u) => u.id === Number(id));
      if (index === -1) return null;
      const [deleted] = mockdata.users.splice(index, 1);
      return deleted;
    },
  },
};
