import { NextResponse } from "next/server";
import { isValidationError, type ValidationError } from "@/lib/response-validator";

export function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    details !== undefined ? { error: message, details } : { error: message },
    { status },
  );
}

export function jsonValidationError(error: ValidationError) {
  return jsonError(error.message, 422, {
    type: error.type,
    raw_output: error.raw_output,
  });
}

export function handleOrchestrationError(error: unknown): NextResponse | null {
  if (isValidationError(error)) {
    return jsonValidationError(error);
  }
  return null;
}

export function parseBody<T>(
  body: unknown,
  parse: (data: unknown) => T,
): T | NextResponse {
  try {
    return parse(body);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Invalid request", 400);
  }
}
