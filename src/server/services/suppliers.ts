import { db } from "@/server/db";
import { ConflictError } from "@/server/errors";
import { supplierCreateSchema } from "@/lib/schemas/supplier";
import type { Supplier } from "@/generated/prisma/client";

export type SupplierDto = Omit<Supplier, "createdAt" | "updatedAt">;

/** The fields the API returns. Listed explicitly, so a new database column is never exposed by accident. */
function toDto(supplier: Supplier): SupplierDto {
  return {
    id: supplier.id,
    name: supplier.name,
    accountNo: supplier.accountNo,
    chargeBankHolidays: supplier.chargeBankHolidays,
    minChargeDays: supplier.minChargeDays,
    damageWaiverPct: supplier.damageWaiverPct,
    paymentTerms: supplier.paymentTerms,
    paymentTermsDays: supplier.paymentTermsDays,
  };
}

export async function listSuppliers(): Promise<SupplierDto[]> {
  const suppliers = await db.supplier.findMany({ orderBy: { name: "asc" } });
  return suppliers.map(toDto);
}

export async function createSupplier(body: unknown): Promise<SupplierDto> {
  const input = supplierCreateSchema.parse(body);
  const existing = await db.supplier.findUnique({ where: { name: input.name } });
  if (existing) {
    throw new ConflictError(
      `A supplier named "${input.name}" already exists`,
      "DUPLICATE_SUPPLIER",
    );
  }
  return toDto(await db.supplier.create({ data: input }));
}
