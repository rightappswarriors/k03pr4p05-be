import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { gql } from "graphql-tag";
import cors from "cors";

// 1. Define schema
// 2. Define resolvers
const resolvers = {
  Query: {
    hello: () => "Hello from Apollo Server v5 🚀",
  },
};

// 3. Initialize Apollo server
async function startApolloServer() {
  const app = express();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await server.start();

  // 👇 use express.json() instead of body-parser.json()
  app.use("/graphql", cors(), express.json(), expressMiddleware(server, {
    context: async ({ req }) => {
      const token = req.headers.authorization || "";
      return { token };
    },
  }));

  const PORT = 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
}

startApolloServer();
