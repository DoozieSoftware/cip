import { IconBuilding } from '@tabler/icons-react';
import { useDepartmentSelection } from '../context/DepartmentSelectionContext';

export function DepartmentSwitcher() {
  const { memberships, selectedId, select, ready } = useDepartmentSelection();

  if (!ready || memberships.length <= 1) {
    return null;
  }

  const current = memberships.find((m) => m.id === selectedId);

  return (
    <label className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#ecebe6] text-[var(--color-text-secondary)]">
        <IconBuilding className="h-4 w-4" stroke={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Working department
        </span>
        <span className="block text-sm font-medium text-[var(--color-ink)]">
          {current?.name ?? 'Select department'}
        </span>
      </div>
      {/* min-w-0 lets the select shrink below its widest option — long department
          names otherwise force the switcher bar wider than a 360px screen. */}
      <select
        value={selectedId ?? ''}
        onChange={(e) => select(e.target.value)}
        aria-label="Working department"
        className="h-9 min-w-0 max-w-[45%] rounded-lg border border-[var(--color-border-faint)] bg-white px-3 pr-8 text-sm text-[var(--color-ink)] focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)] sm:max-w-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2385847f' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '16px',
          appearance: 'none',
        }}
      >
        {memberships.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}
