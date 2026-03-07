import { usrErrors }  from './catalog/usr.errors';
import { connErrors } from './catalog/conn.errors';
import { metaErrors } from './catalog/meta.errors';
import { pipeErrors } from './catalog/pipe.errors';
import { execErrors } from './catalog/exec.errors';
import { orchErrors } from './catalog/orch.errors';
import { cgenErrors } from './catalog/cgen.errors';
import { govErrors }  from './catalog/gov.errors';
import { sysErrors }  from './catalog/sys.errors';

/**
 * AppErrors — the single import for all error factory functions.
 *
 * Usage in any service file:
 *   import { AppErrors } from '@shared/errors';
 *   throw AppErrors.conn.duplicateName('Prod Warehouse');
 *   throw AppErrors.pipe.hasCycle();
 *   throw AppErrors.sys.unexpected(err);
 *
 * Never construct AppError directly in a service file.
 * Never invent ad-hoc error strings — every condition must have a catalog entry.
 */
export const AppErrors = {
  usr:  usrErrors,
  conn: connErrors,
  meta: metaErrors,
  pipe: pipeErrors,
  exec: execErrors,
  orch: orchErrors,
  cgen: cgenErrors,
  gov:  govErrors,
  sys:  sysErrors,
} as const;
