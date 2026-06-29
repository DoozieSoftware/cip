import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ModeratorApp } from './portals/moderator/ModeratorApp';

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
      <ModeratorApp />
    </QueryClientProvider>
  );
}
