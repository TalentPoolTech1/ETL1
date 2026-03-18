import { describe, expect, it } from 'vitest';
import {
  formatValidationError,
  getAllFieldErrors,
  getFieldError,
  groupErrorsByCode,
  hasFieldError,
} from './nodeValidator';

describe('nodeValidator helpers', () => {
  it('returns first field error message', () => {
    const fieldErrors = {
      name: [{ code: 'VAL-001', message: 'Name is required', field: 'name' }],
    };
    expect(getFieldError(fieldErrors, 'name')).toBe('Name is required');
  });

  it('flattens and groups errors', () => {
    const fieldErrors = {
      name: [
        { code: 'VAL-001', message: 'Name is required', field: 'name' },
        { code: 'VAL-001', message: 'Name is required', field: 'name' },
      ],
      table: [{ code: 'VAL-002', message: 'Table is required', field: 'table' }],
    };

    const all = getAllFieldErrors(fieldErrors);
    const grouped = groupErrorsByCode(all);

    expect(all).toHaveLength(3);
    expect(grouped['VAL-001']).toHaveLength(2);
    expect(grouped['VAL-002']).toHaveLength(1);
    expect(hasFieldError(fieldErrors, 'table')).toBe(true);
  });

  it('formats a validation error', () => {
    expect(formatValidationError({ code: 'VAL-100', message: 'Bad config', field: 'config' })).toBe('Bad config (VAL-100)');
  });
});
