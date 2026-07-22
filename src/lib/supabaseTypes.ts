export interface DbResult<T> {
  data: T
  error: null
}

export interface DbError {
  data: null
  error: { message: string; code?: string; details?: string }
}

export type DbResponse<T> = DbResult<T> | DbError

export function isDbError<T>(result: DbResponse<T>): result is DbError {
  return result.error !== null
}

export function unwrapOrThrow<T>(result: DbResponse<T>): T {
  if (isDbError(result)) throw new Error(result.error.message)
  return result.data
}
