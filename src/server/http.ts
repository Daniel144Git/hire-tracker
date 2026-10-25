import { connection } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { OrderRuleError } from "@/lib/orders/status";
import { ConflictError, NotFoundError, ValidationError, type FieldIssue } from "./errors";

/**
 * Every API error has the same shape, so clients and tests can rely on it:
 * { "error": { "code": "VALIDATION_ERROR", "message": "...", "issues": [{ "path": [...], "message": "..." }] } }
 */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  issues?: FieldIssue[],
): Response {
  return Response.json({ error: { code, message, ...(issues ? { issues } : {}) } }, { status });
}

/** Reads the JSON body; a body that is not valid JSON is a 400, not a crash. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

/** Turns any error thrown by a handler into the matching HTTP response. */
export function toErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({
      path: issue.path.map((part) => (typeof part === "symbol" ? String(part) : part)),
      message: issue.message,
    }));
    return errorResponse(400, "VALIDATION_ERROR", "The request is not valid", issues);
  }
  if (error instanceof ValidationError) {
    return errorResponse(400, "VALIDATION_ERROR", error.message, error.issues);
  }
  if (error instanceof NotFoundError) {
    return errorResponse(404, "NOT_FOUND", error.message);
  }
  if (error instanceof ConflictError) {
    return errorResponse(409, error.code, error.message);
  }
  if (error instanceof OrderRuleError) {
    const status = error.code === "OFF_HIRE_BEFORE_START" ? 400 : 409;
    return errorResponse(status, error.code, error.message);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return errorResponse(409, "CONFLICT", "A record with the same unique value already exists");
  }
  console.error(error);
  return errorResponse(500, "INTERNAL_ERROR", "Something went wrong");
}

/**
 * Wraps a route handler: always runs at request time (never prerendered at build time,
 * since it reads the database) and converts thrown errors into JSON error responses.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    await connection();
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
