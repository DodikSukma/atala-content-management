/** Bentuk balikan standar semua server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; code?: ActionErrorCode };

export type ActionErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_FAILED";

export function ok<T>(data: T, message?: string): { ok: true; data: T; message?: string } {
  return { ok: true, data, message };
}

export function fail(
  error: string,
  code?: ActionErrorCode,
  fieldErrors?: Record<string, string>,
): { ok: false; error: string; fieldErrors?: Record<string, string>; code?: ActionErrorCode } {
  return { ok: false, error, code, fieldErrors };
}
