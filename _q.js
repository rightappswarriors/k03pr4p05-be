const { Client } = require("pg");
const c = new Client({ host:"localhost", port:5433, user:"kompra", password:"kompra_dev", database:"kompra_dev" });
(async () => {
  await c.connect();
  const r = await c.query("SELECT id, \"rfqNumber\", \"supplierOrgId\", \"supplierOrgName\", status, \"deletedAt\" IS NOT NULL AS deleted, \"createdAt\" FROM \"RequestForQuotation\" ORDER BY \"createdAt\" DESC");
  console.log("=== RFQ count:", r.rows.length, "===");
  console.table(r.rows.map(x => ({rfqNumber:x.rfqNumber, supplierOrgId:x.supplierOrgId, status:x.status, deleted:x.deleted, created:new Date(x.createdAt).toISOString().slice(0,19)})));
  const orgs = await c.query("SELECT id, name, \"verificationStatus\" FROM \"Organization\" ORDER BY id");
  console.log("=== Organizations count:", orgs.rows.length, "===");
  console.table(orgs.rows);
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
