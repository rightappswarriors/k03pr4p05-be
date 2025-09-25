// Fake data store (could be DB, REST API, etc.)
export let users = [
    { id: 1, fullname: "Alice", username: "alice", email: "alice@test.com" },
    { id: 2, fullname: "Bob", username: "bob", email: "bob@test.com" },
];
export let branch = [
    { id: 1, name: "Main Branch", address: "123 Street", ownerId: 1 },
];
export let store = [
    { id: 1, name: "Store A", address: "456 Road", branchId: 1, ownerId: 1 },
];
