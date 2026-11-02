import { describe, expect, it } from 'vitest';
import { roleLabel } from '@/lib/role-labels';

describe('roleLabel', () => {
  it('maps API role codes to merchant-facing labels', () => {
    expect(roleLabel('STORE_MANAGER')).toBe('Manager');
    expect(roleLabel('OWNER')).toBe('Owner');
    expect(roleLabel('STORE_STAFF')).toBe('Staff');
  });

  it('humanizes unknown codes and handles missing roles', () => {
    expect(roleLabel('SOME_NEW_ROLE')).toBe('Some new role');
    expect(roleLabel(undefined)).toBe('—');
  });
});
