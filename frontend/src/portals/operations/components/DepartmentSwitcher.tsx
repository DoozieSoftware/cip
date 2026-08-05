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
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#ecebe6] text-[#6f6e69]">
        <IconBuilding className="h-4 w-4" stroke={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[#85847f]">
          Working department
        </span>
        <span className="block text-sm font-medium text-[#1d1d1b]">
          {current?.name ?? 'Select department'}
        </span>
      </div>
      <select
        value={selectedId ?? ''}
        onChange={(e) => select(e.target.value)}
        aria-label="Working department"
        className="h-9 rounded-lg border border-[#d9d7d0] bg-white px-3 pr-8 text-sm text-[#1d1d1b] focus:border-[#1d1d1b] focus:outline-none focus:ring-1 focus:ring-[#1d1d1b]"
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
