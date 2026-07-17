// types/context.ts
import { PrismaClient } from '@prisma/client';
import { RedisClientType } from 'redis';

// ---- Permission shapes ----
export interface PagePermission {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

// ---- User shape (matches your prisma select in server.ts) ----
export interface ContextUser {
    id: number;
    userId: number;       // alias for backward compat
    email: string;
    fullname?: string | null;
    username?: string | null;
    role: 'OWNER' | 'CASHIER' | 'STAFF' | 'MANAGER' | 'ADMIN' | 'SUPPLIER' | 'CUSTOMER';
    isVerified?: boolean;
    isOwner: boolean;
    orgId: number;
    approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
    position?: {
        id: string;
        name: string;
        permissions: {
            canView: boolean;
            canCreate: boolean;
            canEdit: boolean;
            canDelete: boolean;
            page: {
                key: string;
                label: string;
                access: string;
                parentKey?: string | null;
            };
        }[];
        controlPermissions: {
            controlKey: string;
            isAllowed: boolean;
        }[];
    } | null;
}

// ---- Main Context ----
export interface Context {
    prisma: PrismaClient;
    redisClient: RedisClientType;
    req: Request;
    res: Response;
    user: ContextUser | null;

    // Pre-built at request time in server.ts
    userPermissions: Record<string, PagePermission>;     // indexed by page.key
    controlPermissions: Record<string, boolean>;          // indexed by controlKey

    // Attached by requirePagePermission for resolver use
    permission?: PagePermission;
}