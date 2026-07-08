import { describe, it, expect } from 'vitest';
import { departmentApi, adminApi } from './operations';

describe('operations API surface', () => {
  it('departmentApi exposes the expected methods', () => {
    expect(typeof departmentApi.dashboard).toBe('function');
    expect(typeof departmentApi.listReports).toBe('function');
    expect(typeof departmentApi.showReport).toBe('function');
    expect(typeof departmentApi.exportUrl).toBe('function');
    expect(typeof departmentApi.action).toBe('function');
    expect(typeof departmentApi.listNotes).toBe('function');
    expect(typeof departmentApi.addNote).toBe('function');
  });

  it('adminApi exposes the expected methods', () => {
    expect(typeof adminApi.listOfficers).toBe('function');
    expect(typeof adminApi.attachOfficer).toBe('function');
    expect(typeof adminApi.detachOfficer).toBe('function');
    expect(typeof adminApi.updateAdmin).toBe('function');
  });

  it('exportUrl builds a path with the format query', () => {
    const url = departmentApi.exportUrl('csv');
    expect(url).toContain('/department/reports/export');
    expect(url).toContain('format=csv');
  });

  it('exportUrl respects filter arguments', () => {
    const url = departmentApi.exportUrl('xlsx', { status: 'assigned', per_page: 10 });
    expect(url).toContain('format=xlsx');
    expect(url).toContain('status=assigned');
    expect(url).toContain('per_page=10');
  });

  it('exportUrl omits empty filter values', () => {
    const url = departmentApi.exportUrl('pdf', { status: '', search: undefined, page: 1 });
    expect(url).not.toContain('status=');
    expect(url).not.toContain('search=');
    expect(url).toContain('page=1');
  });
});

describe('auditApi surface (T-M11-019)', () => {
  it('exposes the expected methods', async () => {
    const { auditApi } = await import('./operations');
    expect(typeof auditApi.list).toBe('function');
    expect(typeof auditApi.exportUrl).toBe('function');
  });

  it('exportUrl builds a path with filter params', async () => {
    const { auditApi } = await import('./operations');
    const url = auditApi.exportUrl({ action: 'report.department_action', role: 'moderator' });
    expect(url).toContain('/admin/audit-logs');
    expect(url).toContain('action=report.department_action');
    expect(url).toContain('role=moderator');
  });
});

describe('securityApi surface (T-M11-020)', () => {
  it('exposes the dashboard method', async () => {
    const { securityApi } = await import('./operations');
    expect(typeof securityApi.dashboard).toBe('function');
  });
});
