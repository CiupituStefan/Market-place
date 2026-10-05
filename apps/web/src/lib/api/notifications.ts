'use client';

import {
  NotificationPreferencesSchema,
  UnsubscribeResultSchema,
  type UpdateNotificationPreferences,
} from '@market/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from './browser';

const key = ['notification-preferences'] as const;

export function useNotificationPreferences() {
  return useQuery({
    queryKey: key,
    queryFn: () => api('/notifications/preferences', { schema: NotificationPreferencesSchema }),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNotificationPreferences) =>
      api('/notifications/preferences', {
        method: 'PUT',
        body: input,
        schema: NotificationPreferencesSchema,
      }),
    onSuccess: (preferences) => {
      queryClient.setQueryData(key, preferences);
    },
  });
}

export function useConfirmNewsletter() {
  return useMutation({
    mutationFn: (token: string) =>
      api('/newsletter/confirm', { method: 'POST', body: { token }, schema: z.unknown() }),
  });
}

export function useUnsubscribe() {
  return useMutation({
    mutationFn: (token: string) =>
      api('/notifications/unsubscribe', {
        method: 'POST',
        body: { token },
        schema: UnsubscribeResultSchema,
      }),
  });
}
