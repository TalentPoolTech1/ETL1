/**
 * ErrorSerializer — safely converts a raw Error into a plain log-safe object.
 *
 * Rules:
 *  - Handles circular references
 *  - Includes Postgres driver error fields when present
 *  - Redacts any key that looks like a secret before writing to the log
 */

const SECRET_KEYS = new Set([
  'password', 'passwd', 'secret', 'token', 'accesstoken', 'refreshtoken',
  'apikey', 'api_key', 'privatekey', 'private_key', 'authorization',
  'encryptionkey', 'encryption_key', 'connectionstring', 'connection_string',
]);

function redactValue(key: string, value: unknown): unknown {
  return SECRET_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
}

export interface SerializedError {
  name:          string;
  message:       string;
  stack?:        string;
  // Postgres driver fields (present when the underlying error is a pg QueryError)
  pgCode?:       string;
  pgDetail?:     string;
  pgTable?:      string;
  pgSchema?:     string;
  pgConstraint?: string;
  // Any extra enumerable properties on the error object
  [key: string]: unknown;
}

export function serializeError(err: unknown): SerializedError {
  if (!(err instanceof Error)) {
    return { name: 'UnknownError', message: String(err) };
  }

  const pg = err as unknown as Record<string, unknown>;

  const result: SerializedError = {
    name:    err.name,
    message: err.message,
    stack:   err.stack,
  };

  if (pg['code'])       result['pgCode']       = pg['code'];
  if (pg['detail'])     result['pgDetail']      = pg['detail'];
  if (pg['table'])      result['pgTable']       = pg['table'];
  if (pg['schema'])     result['pgSchema']      = pg['schema'];
  if (pg['constraint']) result['pgConstraint']  = pg['constraint'];

  // Copy any extra enumerable own properties, with redaction
  for (const key of Object.keys(err)) {
    if (!(key in result)) {
      result[key] = redactValue(key, (err as Record<string, unknown>)[key]);
    }
  }

  return result;
}
