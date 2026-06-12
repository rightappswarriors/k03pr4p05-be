// graphql/types/contact/contactResolvers.ts
import { extendType, intArg, nonNull, nullable, stringArg, booleanArg, list } from 'nexus';
import { requireAuth } from '../../../middleware/auth.middleware.js';
// ─── Queries ─────────────────────────────────────────────────────────────────
export const ContactQuery = extendType({
    type: 'Query',
    definition(t) {
        // Get all contacts for an org — optionally filter to a specific branch
        // Returns: global contacts (branchId IS NULL) + branch-specific contacts
        // If branchId is provided, returns global + that branch's contacts
        // If branchId is omitted, returns ALL contacts for the org
        t.field('contacts', {
            type: list('Contact'),
            args: {
                branchId: nullable(intArg()), // optional — filters to global + this branch
                query: nullable(stringArg()),
            },
            resolve: async (_, { branchId, query }, ctx) => {
                requireAuth(ctx);
                const orgId = ctx.user?.orgId;
                if (!orgId)
                    throw new Error('Organization ID is required');
                const where = { orgId, isActive: true };
                if (branchId !== undefined && branchId !== null) {
                    // Return global (branchId IS NULL) + this branch's contacts
                    where.OR = [
                        { branchId: null },
                        { branchId },
                    ];
                }
                if (query) {
                    const q = query.trim();
                    where.AND = [
                        {
                            OR: [
                                { label: { contains: q, mode: 'insensitive' } },
                                { name: { contains: q, mode: 'insensitive' } },
                                { email: { contains: q, mode: 'insensitive' } },
                                { department: { contains: q, mode: 'insensitive' } },
                                { position: { contains: q, mode: 'insensitive' } },
                            ],
                        },
                    ];
                }
                return ctx.prisma.contact.findMany({
                    where,
                    orderBy: [
                        { branchId: 'asc' }, // globals first (null sorts before values)
                        { label: 'asc' },
                    ],
                });
            },
        });
        // Single contact by id
        t.field('contact', {
            type: nullable('Contact'),
            args: { id: nonNull(intArg()) },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                const orgId = ctx.user?.orgId;
                if (!orgId)
                    throw new Error('Organization ID is required');
                return ctx.prisma.contact.findUnique({ where: { id, orgId } });
            },
        });
    },
});
// ─── Mutations ────────────────────────────────────────────────────────────────
export const ContactMutation = extendType({
    type: 'Mutation',
    definition(t) {
        t.field('createContact', {
            type: 'Contact',
            args: {
                branchId: nullable(intArg()), // omit or null for global
                label: nonNull(stringArg()),
                name: nonNull(stringArg()),
                email: nonNull(stringArg()),
                phone: nullable(stringArg()),
                position: nullable(stringArg()),
                department: nullable(stringArg()),
                notes: nullable(stringArg()),
            },
            resolve: async (_, args, ctx) => {
                requireAuth(ctx);
                const { branchId, label, name, email, phone, position, department, notes } = args;
                const orgId = ctx.user?.orgId;
                if (!orgId)
                    throw new Error('Organization ID is required');
                return ctx.prisma.contact.create({
                    data: {
                        orgId,
                        branchId: branchId ?? null,
                        label,
                        name,
                        email,
                        phone: phone ?? null,
                        position: position ?? null,
                        department: department ?? null,
                        notes: notes ?? null,
                    },
                });
            },
        });
        t.field('updateContact', {
            type: 'Contact',
            args: {
                id: nonNull(intArg()),
                branchId: nullable(intArg()),
                label: nullable(stringArg()),
                name: nullable(stringArg()),
                email: nullable(stringArg()),
                phone: nullable(stringArg()),
                position: nullable(stringArg()),
                department: nullable(stringArg()),
                notes: nullable(stringArg()),
                isActive: nullable(booleanArg()),
            },
            resolve: async (_, { id, ...data }, ctx) => {
                requireAuth(ctx);
                // Strip undefined args so we do partial updates cleanly
                const orgId = ctx.user?.orgId;
                if (!orgId)
                    throw new Error('Organization ID is required');
                const patch = {};
                for (const [k, v] of Object.entries(data)) {
                    if (v !== undefined)
                        patch[k] = v;
                }
                return ctx.prisma.contact.update({ where: { id, orgId }, data: patch });
            },
        });
        t.field('deleteContact', {
            type: 'Contact',
            args: { id: nonNull(intArg()) },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                return ctx.prisma.contact.update({
                    where: { id },
                    data: { deletedAt: new Date() },
                });
            },
        });
        // Soft-toggle isActive
        t.field('toggleContact', {
            type: 'Contact',
            args: { id: nonNull(intArg()) },
            resolve: async (_, { id }, ctx) => {
                requireAuth(ctx);
                const current = await ctx.prisma.contact.findUniqueOrThrow({ where: { id } });
                return ctx.prisma.contact.update({
                    where: { id },
                    data: { isActive: !current.isActive },
                });
            },
        });
    },
});
