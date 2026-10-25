/** A field-level problem, reported to the client as { path, message }. */
export interface FieldIssue {
  path: (string | number)[];
  message: string;
}

/** 400: the request is well-formed JSON but its content is not acceptable. */
export class ValidationError extends Error {
  constructor(
    message: string,
    readonly issues: FieldIssue[] = [],
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/** 404: the resource in the URL does not exist. */
export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`);
    this.name = "NotFoundError";
  }
}

/** 409: the request conflicts with existing data, e.g. a duplicate site code. */
export class ConflictError extends Error {
  constructor(
    message: string,
    readonly code = "CONFLICT",
  ) {
    super(message);
    this.name = "ConflictError";
  }
}
