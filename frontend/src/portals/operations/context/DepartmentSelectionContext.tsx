import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentApi, type Membership } from '../api/operations';

const STORAGE_KEY = 'cip.operations.department_id';

interface DepartmentSelectionValue {
  memberships: Membership[];
  selectedId: string | null;
  select: (id: string) => void;
  ready: boolean;
}

const DepartmentSelectionContext = createContext<DepartmentSelectionValue | null>(null);

export function DepartmentSelectionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['operations', 'memberships'],
    queryFn: () => departmentApi.memberships(),
    retry: false,
  });

  const memberships = useMemo(() => data ?? [], [data]);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY),
  );

  // Keep the selection valid: default to the first membership (the backend
  // resolver uses the same alphabetical default), drop stale ids.
  useEffect(() => {
    if (isLoading || isError) return;
    if (memberships.length === 0) {
      setSelectedId(null);
      return;
    }
    if (selectedId === null || !memberships.some((m) => m.id === selectedId)) {
      setSelectedId(memberships[0].id);
      window.localStorage.setItem(STORAGE_KEY, memberships[0].id);
    }
  }, [isLoading, isError, memberships, selectedId]);

  const value = useMemo<DepartmentSelectionValue>(
    () => ({
      memberships,
      selectedId,
      ready: !isLoading,
      select: (id: string) => {
        window.localStorage.setItem(STORAGE_KEY, id);
        setSelectedId(id);
        void queryClient.invalidateQueries({ queryKey: ['operations'] });
      },
    }),
    [memberships, selectedId, isLoading, queryClient],
  );

  return (
    <DepartmentSelectionContext.Provider value={value}>
      {children}
    </DepartmentSelectionContext.Provider>
  );
}

export function useDepartmentSelection(): DepartmentSelectionValue {
  const ctx = useContext(DepartmentSelectionContext);
  if (ctx === null) {
    throw new Error('useDepartmentSelection must be used inside DepartmentSelectionProvider');
  }
  return ctx;
}
