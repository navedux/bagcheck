export type ApiError = {
  code: string;
  message: string;
};

export type Ok<T> = { ok: true; data: T; stale?: boolean };
export type Err = { ok: false; error: ApiError; stale?: boolean };

export function ok<T>(data: T, stale = false): Ok<T> {
  return stale ? { ok: true, data, stale } : { ok: true, data };
}

export function err(code: string, message: string, stale = false): Err {
  return stale ? { ok: false, error: { code, message }, stale } : { ok: false, error: { code, message } };
}
