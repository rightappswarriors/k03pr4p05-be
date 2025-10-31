# 🧾 RAI POS Backend

This repository contains the **backend API** for the **RAI POS (Point of Sale Management System)**.  
It provides a robust GraphQL-based API built with **Node.js**, **Express**, **Apollo Server**, **Nexus**, and **Prisma ORM**, designed for scalability, modularity, and type safety.

---

## 🚀 Tech Stack

- **Node.js** + **Express**
- **GraphQL (Apollo Server)**
- **Nexus** (for schema & resolver definitions)
- **Prisma ORM** (database layer)
- **JWT Authentication**
- **Dotenv**, **Cors**, **Cookie-parser**

---

## 📦 Repository

**Git URL:**  
`git@github.com:rightappsinc/rai-pos-backend.git`

---

## 🧰 Project Overview

The RAI POS backend handles the following:
- User authentication and role-based access control  
- Management of branches, outlets, items, inventory, and transactions  
- Integration with payment gateways  
- API key and mode-of-payment modules  
- Prisma ORM-powered database layer  
- GraphQL schema generation via Nexus

---

## 🛠️ Getting Started

- Follow these steps to clone and run the backend locally:

### 1. Clone the Repository
```bash
git clone git@github.com:rightappsinc/rai-pos-backend.git
cd rai-pos-backend
```
### 2. Install Dependencies
```
npm install
```

### 3. Setup Environment Variables
-- Create a .env file in the root directory and define:
```
DATABASE_URL="postgresql://neondb_owner:npg_Jt95VqcfpZmo@ep-divine-flower-a1pozdpa-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
JWT_SECRET="JWT_SECRET"
REFRESH_SECRET="REFRESH_SECRET"
NODE_ENV="localhost"
ENCRYPTION_KEY=7a56574ad91e6b16308d5b0ceef1766d4746aaddfa8678c67de5ba61d21ca533
```
### 4. Setup Prisma
-- Generate Prisma client and apply migrations:
```
npx prisma generate
npx prisma migrate dev --name init
```
You can also open Prisma Studio (visual DB tool) with:
```
npx prisma studio
```
### 5. Run the Development Server
-- npm run dev
Your GraphQL server will be available at:
👉 http://localhost:4000/graphql

⚠️ Contribution Workflow
🔒 Important: Do NOT push directly to the main branch.

We follow a branching workflow to ensure code stability and smooth collaboration.

✅ Steps to Contribute:
Create a new branch for your feature or bug fix:
```
git checkout -b feature/your-feature-name
```
Make your changes and commit:
```
git add .
git commit -m "Add: implemented branch creation mutation"
```
Push to your branch:
```
git push origin feature/your-feature-name
```
Create a Pull Request (PR) to merge your changes into main.
Your code will be reviewed before merging.

📁 Folder Structure
pgsql
Copy code
rai-pos-backend/
│
├── prisma/
│   └── schema.prisma              # Database models & relationships (Prisma ORM)
│
├── src/
│   ├── graphql/
│   │   ├── resolvers/             # GraphQL mutations & queries (Nexus)
│   │   └── typeDefs/              # GraphQL type definitions (Nexus object types)
│   │
│   ├── middleware/                # Authentication, authorization, ownership checks
│   ├── services/                  # Database operations (business logic using Prisma)
│   ├── index.ts                   # Main entry point (server setup)
│
├── package.json
├── .env (not committed)
└── README.md
📘 Detailed Directory Explanation
🧠 prisma/schema.prisma
Defines your database schema, models, and relationships using Prisma ORM.
It acts as the single source of truth for your database structure.

Example:

prisma
```
model Branch {
  id        Int      @id @default(autoincrement())
  name      String
  address   String
  ownerId   Int
  owner     User     @relation(fields: [ownerId], references: [id])
  createdAt DateTime @default(now())
}
```
After making changes to this file:
```bash
npx prisma generate
npx prisma migrate dev --name update_schema
```
⚙️ src/graphql/resolvers/
Contains all GraphQL resolvers (queries & mutations) using Nexus.

Resolvers define the business actions (e.g. create, update, delete) and call the corresponding service layer.

Example:

```js
t.nonNull.field("createBranch", {
  type: "Branch",
  args: {
    name: nonNull(arg({ type: "String" })),
    address: nonNull(arg({ type: "String" })),
    phone: nonNull(arg({ type: "String" })),
  },
  async resolve(_, { name, address, phone }, ctx) {
    requireAuth(ctx);
    requireRole(ctx, ["ADMIN"]);
    return await branchService.createBranch({ name, address, phone }, ctx.user.userId);
  },
});
```
🧩 src/graphql/typeDefs/
Defines the GraphQL schema types (object types, inputs, enums, etc.) using Nexus.
These describe what data is available through the GraphQL API.

Example:

```js
export const Branch = objectType({
  name: "Branch",
  definition(t) {
    t.nonNull.int("id");
    t.nonNull.string("name");
    t.nonNull.string("address");
    t.nonNull.dateTime("createdAt");
  },
});
```
🧰 src/services/
Contains business logic and database operations using Prisma Client.
Resolvers delegate to these functions for database interactions.

Example:

```js
Copy code
export const createBranch = async (branchData, ownerId) => {
  return await prisma.branch.create({
    data: {
      ...branchData,
      ownerId,
    },
  });
};
```
🔐 src/middleware/
Middleware for authentication and authorization in resolvers.

Includes helpers such as:

requireAuth(ctx) → checks if the user is authenticated

requireRole(ctx, ["ADMIN"]) → restricts access by role

requireOwnership(ctx, "branch", id) → ensures user owns the resource

Used in resolver functions to protect routes.

🚀 src/index.ts
The main server entry file.
It sets up Express, Apollo Server, CORS, and connects Prisma to the GraphQL context.

Key responsibilities:

Initialize the GraphQL schema with Nexus

Start Apollo Server on port 4000

Load environment variables

Configure middleware (CORS, JWT auth, cookie parser)

Example:
```js
const server = new ApolloServer({ schema });

await server.start();
app.use(
  "/graphql",
  cors({ origin: ["http://localhost:4000"], credentials: true }),
  expressMiddleware(server, {
    context: async ({ req }) => {
      const token = req.headers.authorization?.split(" ")[1];
      const user = token ? jwt.verify(token, JWT_SECRET) : null;
      return { prisma, user, req };
    },
  })
);
```
🧑‍💻 Common Commands
Command	Description
```bash
npm run dev	# Start the development server
npx prisma #studio	Open the Prisma Studio web interface
npx prisma generate	#Regenerate Prisma client after schema changes
npx prisma migrate dev	#Apply database migrations
npm run build	#Build for production
```
🧾 License
This project is licensed under the MIT License.
You are free to use, modify, and distribute it with attribution.

👥 Maintainers
Right Apps Inc.

Repository: rightappsinc/rai-pos-backend
Maintained by: Development Team @ RightApps
