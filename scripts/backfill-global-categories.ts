import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { isAmbiguousLegacyCategoryName, normalizeCategoryKey, normalizeCategoryName } from '../src/services/globalCategory.service.js';

const apply = process.argv.includes('--apply');

type LegacyCategory = { id: string; name: string; catalogId: string; _count: { items: number } };

async function main() {
  const legacyCategories: LegacyCategory[] = await prisma.supplierItemCategory.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, catalogId: true, _count: { select: { items: true } } },
    orderBy: { name: 'asc' },
  });
  const groups = new Map<string, LegacyCategory[]>();
  for (const category of legacyCategories) {
    const key = normalizeCategoryKey(category.name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), category]);
  }

  const report = { mode: apply ? 'apply' : 'dry-run', categoriesDiscovered: legacyCategories.length, uniqueNormalizedNames: groups.size, duplicateGroups: 0, categoriesCreated: 0, itemsMapped: 0, ambiguousRows: [] as Array<{ id: string; name: string; itemCount: number }>, skippedRows: [] as Array<{ id: string; name: string; reason: string }>, errors: [] as Array<{ name: string; error: string }> };

  for (const [key, rows] of groups) {
    if (rows.length > 1) report.duplicateGroups += 1;
    if (isAmbiguousLegacyCategoryName(rows[0].name)) {
      report.ambiguousRows.push(...rows.map((row) => ({ id: row.id, name: row.name, itemCount: row._count.items })));
      continue;
    }
    const name = normalizeCategoryName(rows[0].name);
    try {
      let category = await prisma.category.findFirst({ where: { parentId: null, name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
      if (!category && apply) {
        const slug = key.replace(/\s+/g, '-');
        const conflictingSlug = await prisma.category.findUnique({ where: { slug } });
        if (conflictingSlug) {
          report.skippedRows.push(...rows.map((row) => ({ id: row.id, name: row.name, reason: 'Slug conflicts with an existing non-matching category.' })));
          continue;
        }
        category = await prisma.category.create({ data: { name, slug } });
        report.categoriesCreated += 1;
      }
      if (!category) continue;
      if (apply) {
        const legacyIds = rows.map((row) => row.id);
        const result = await prisma.supplierItem.updateMany({ where: { categoryId: { in: legacyIds }, globalCategoryId: null, deletedAt: null }, data: { globalCategoryId: category.id } });
        report.itemsMapped += result.count;
      }
    } catch (error) {
      report.errors.push({ name, error: error instanceof Error ? error.message : String(error) });
    }
  }

  console.log(JSON.stringify(report, null, 2));
  if (!apply) console.log('\nDry run only. Re-run with --apply after reviewing this report.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
