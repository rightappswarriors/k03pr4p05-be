import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { gql } from "graphql-tag";
import cors from "cors";
import bodyParser from "body-parser";

// 1. Define schema
const typeDefs = gql`
  type Query {
    hello: String
  }
`;

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

  // 4. Apply Express middleware
  app.use(
    "/graphql",
    cors(),
    bodyParser.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Example: auth token
        const token = req.headers.authorization || "";
        return { token };
      },
    })
  );

  // 5. Start Express
  const PORT = 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
}

startApolloServer();
