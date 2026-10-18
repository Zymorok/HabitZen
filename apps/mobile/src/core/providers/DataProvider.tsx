import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { isConflict } from '../supabase/errors';

/**
 * Кеш серверных данных (TanStack Query).
 * NOTE: Кеш производный: источник истины — сервер. При выходе он очищается целиком.
 */
export function DataProvider({ children }: { readonly children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // NOTE: Конфликт и ошибки прав не лечатся повтором — только сетевые сбои.
            retry: (count, error) => count < 2 && !isConflict(error),
          },
          mutations: { retry: false },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
