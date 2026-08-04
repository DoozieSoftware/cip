import { useDepartmentSelection } from '../context/DepartmentSelectionContext';

export function DepartmentSwitcher() {
  const { memberships, selectedId, select, ready } = useDepartmentSelection();

  if (!ready || memberships.length <= 1) {
    return null;
  }

  return (
    <label className="block px-3 py-2">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Working department
      </span>
      <select
        value={selectedId ?? ''}
        onChange={(e) => select(e.target.value)}
        aria-label="Working department"
        className="block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
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
