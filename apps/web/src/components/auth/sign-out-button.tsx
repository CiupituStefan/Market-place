'use client';

import { useI18n } from '@/components/i18n/provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOutIcon } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';

export function SignOutButton() {
  const { t, path } = useI18n();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST', schema: z.unknown() }),
    // Even if the call fails, drop every cached private query on this device.
    onSettled: () => {
      queryClient.clear();
      // A full page load on sign-out guarantees no private data survives in client caches.

      window.location.assign(path('/'));
    },
  });
  return (
    <Button
      variant="outline"
      disabled={signOut.isPending}
      onClick={() => {
        signOut.mutate();
      }}
    >
      <LogOutIcon /> {signOut.isPending ? t.auth.signingOut : t.auth.signOut}
    </Button>
  );
}
