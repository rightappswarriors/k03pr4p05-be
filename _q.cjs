const { Client } = require("pg");
const c = new Client({ host:"localhost", port:5433, user:"kompra", password:"kompra_dev", database:"kompra_dev" });
(async () => {
  await c.connect();
  const u = await c.query("SELECT id, email, \"fullname\", role, \"orgId\" FROM \"User\" ORDER BY id");
  console.log("=== Users ===");
  console.table(u.rows);
  const a = await c.query("SELECT id, \"fullname\", \"organizationId\" FROM \"Agent\" ORDER BY id");
  console.log("=== Agents ===");
  console.table(a.rows);
  const org = await c.query("SELECT id, name, \"roles\" FROM \"Organization\" ORDER BY id");
  console.log("=== Org roles ===");
  console.table(org.rows);
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
