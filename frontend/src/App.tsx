import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function App() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <main className="min-h-screen flex items-center justify-center bg-brand-50 text-slate-900">
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-brand-700">Civic Intelligence Platform</h1>
          <p className="mt-2 text-slate-600">Frontend base libraries installed (T-M1-009)</p>
        </div>
      </main>
    </QueryClientProvider>
  );
}
