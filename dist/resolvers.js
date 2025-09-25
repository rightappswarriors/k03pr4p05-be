import * as mockdata from "./mock.js";
export const resolvers = {
    Query: {
        users: () => mockdata.users,
        branches: () => mockdata.branch,
        stores: () => mockdata.store,
        user: (_, { id }) => mockdata.users.find((u) => u.id === Number(id)),
        store: (_, { id }) => mockdata.store.find((s) => s.id === Number(id)),
    },
    Mutation: {
        createUser: (_, { data }) => {
            const newUser = { id: mockdata.users.length + 1, ...data };
            mockdata.users.push(newUser);
            return newUser;
        },
        deleteUser: (_, { id }) => {
            const index = mockdata.users.findIndex((u) => u.id === Number(id));
            if (index === -1)
                return null;
            const [deleted] = mockdata.users.splice(index, 1);
            return deleted;
        },
    },
    User: {
        branchesOwned: (parent) => mockdata.branch.filter((b) => b.ownerId === parent.id),
        storesOwned: (parent) => mockdata.store.filter((s) => s.ownerId === parent.id),
    },
    Branch: {
        owner: (parent) => mockdata.users.find((u) => u.id === parent.ownerId),
        stores: (parent) => mockdata.store.filter((s) => s.branchId === parent.id),
    },
    Store: {
        owner: (parent) => mockdata.users.find((u) => u.id === parent.ownerId),
        branch: (parent) => mockdata.branch.find((b) => b.id === parent.branchId),
    },
};
