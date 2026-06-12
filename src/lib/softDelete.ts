import { Prisma } from "@prisma/client";

export const SOFT_DELETE_MODELS = new Set([
  "Organization",
  "Subscription",
  "User",
  "PaymongoAPIKeys",
  "Branch",
  "Contact",
  "PlaceLocation",
  "Outlet",
  "PromoType",
  "OutletPromo",
  "Inventory",
  "Location",
  "StockMovement",
  "InventoryItems",
  "ItemCategory",
  "OrgItemCategory",
  "ItemGroup",
  "VatType",
  "Item",
  "SalesOrder",
  "ExtraCharge",
  "SalesOrderItem",
  "SalesOrderDelivery",
  "ItemUnit",
  "InventoryItemUnit",
  "CustomerDetails",
  "KompraCOrder",
  "Courier",
  "KompraCustomer",
  "DeliveryAddress",
  "KompraCOrderItem",
  "KompraCOrderFee",
  "KompraCDeliveryTracking",
  "OutletDeliveryConfig",
  "Color",
  "CostLines",
  "SupplierOrder",
  "SupplierOrderItem",
  "RestockCycle",
  "RestockCycleItem",
  "StockBatch",
  "RestockSchedule",
  "RestockScheduleItem",
  "Media",
  "StockLocation",
  "Brand",
  "Transaction",
  "ScPwdCustomer",
  "CustomerDeviceToken",
  "InventoryItem",
  "Department",
  "Notification",
  "Position",
  "Center",
  "SubCenter",
  "AccountTitle",
  "Employee",
  "Shift",
  "Attendance",
  "GISRow",
  "Budget",
  "SummaryRow",
  "Page",
  "AuditLog",
  "DiscountAudit",
]);

const READ_OPERATIONS = new Set(["findMany", "findFirst", "findUnique", "count", "aggregate", "groupBy"]);
const dmmfModels = new Map(
  ((Prisma as any).dmmf?.datamodel?.models ?? []).map((model: any) => [model.name, model]),
);

function hasExplicitDeletedAt(where: any): boolean {
  if (!where || typeof where !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(where, "deletedAt")) return true;
  return ["AND", "OR", "NOT"].some((key) => {
    const value = where[key];
    if (Array.isArray(value)) return value.some(hasExplicitDeletedAt);
    return hasExplicitDeletedAt(value);
  });
}

function applyWhereFilter(args: any) {
  args.where = args.where ?? {};
  if (!hasExplicitDeletedAt(args.where)) {
    args.where.deletedAt = null;
  }
}

function relationModel(parentModel: string, fieldName: string): string | undefined {
  const model: any = dmmfModels.get(parentModel);
  const field = model?.fields?.find((candidate: any) => candidate.name === fieldName);
  return field?.kind === "object" ? field.type : undefined;
}

function isListRelation(parentModel: string, fieldName: string): boolean {
  const model: any = dmmfModels.get(parentModel);
  const field = model?.fields?.find((candidate: any) => candidate.name === fieldName);
  return Boolean(field?.isList);
}

function applyNestedRelationFilters(parentModel: string, node: any) {
  if (!node || typeof node !== "object") return;

  for (const containerKey of ["include", "select"]) {
    const container = node[containerKey];
    if (!container || typeof container !== "object") continue;

    for (const [fieldName, value] of Object.entries(container)) {
      const childModel = relationModel(parentModel, fieldName);
      if (!childModel) continue;

      const childCanBeFiltered = SOFT_DELETE_MODELS.has(childModel);
      const childIsList = isListRelation(parentModel, fieldName);

      if (value === true) {
        if (childCanBeFiltered && childIsList) {
          container[fieldName] = { where: { deletedAt: null } };
        }
        continue;
      }

      if (!value || typeof value !== "object") continue;

      if (childCanBeFiltered && childIsList) {
        applyWhereFilter(value);
      }
      applyNestedRelationFilters(childModel, value);
    }
  }
}

export function softDeleteExtension() {
  return Prisma.defineExtension({
    name: "softDelete",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (model && READ_OPERATIONS.has(operation) && SOFT_DELETE_MODELS.has(model)) {
            args = args ?? {};
            const includeDeleted = Boolean(args.includeDeleted);
            delete args.includeDeleted;
            if (!includeDeleted) {
              applyWhereFilter(args);
              applyNestedRelationFilters(model, args);
            }
          }
          return query(args);
        },
      },
    },
  });
}

export async function restoreById(prisma: any, model: string, id: string | number) {
  if (!SOFT_DELETE_MODELS.has(model)) {
    throw new Error(`Model ${model} is not configured for soft delete.`);
  }
  const delegate = prisma[model.charAt(0).toLowerCase() + model.slice(1)];
  if (!delegate?.update) throw new Error(`Prisma delegate not found for ${model}.`);
  return delegate.update({ where: { id }, data: { deletedAt: null } });
}

export async function restoreMany(prisma: any, model: string, where: Record<string, any>) {
  if (!SOFT_DELETE_MODELS.has(model)) {
    throw new Error(`Model ${model} is not configured for soft delete.`);
  }
  const delegate = prisma[model.charAt(0).toLowerCase() + model.slice(1)];
  if (!delegate?.updateMany) throw new Error(`Prisma delegate not found for ${model}.`);
  return delegate.updateMany({ where, data: { deletedAt: null } });
}
