'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOutIcon } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';

export function SignOutButton() {
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST', schema: z.unknown() }),
    // Even if the call fails, drop every cached private query on this device.
    onSettled: () => {
      queryClient.clear();
      // A full page load on sign-out guarantees no private data survives in client caches.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional hard navigation
      window.location.assign('/');
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
      <LogOutIcon /> {signOut.isPending ? 'Signing out…' : 'Sign out'}
    </Button>
  );
}
