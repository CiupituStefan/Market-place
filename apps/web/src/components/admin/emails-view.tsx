'use client';

import { NOTIFICATION_LOG_STATUSES } from '@market/types';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEmailLog, useRetryEmail } from '@/lib/api/admin';
import { formatDateTime } from '@/lib/format';
import { DataTable, ErrorNote, Pagination, SearchBox, SelectField, Toolbar } from './admin-page';

export function EmailsView() {
  const [status, setStatus] = useState('');
  const [recipient, setRecipient] = useState('');
  const [page, setPage] = useState(1);
  const log = useEmailLog({ status: status || undefined, recipient, page });
  const retry = useRetryEmail();
  const onSearch = useCallback((value: string) => {
    // The service filters by exact address: search only once it looks like one.
    setRecipient(value.includes('@') && value.includes('.') ? value : '');
    setPage(1);
  }, []);

  return (
    <>
      <Toolbar>
        <SearchBox label="Recipient" placeholder="customer@example.com" onSearch={onSearch} />
        <SelectField
          label="Status"
          hideLabel
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All statuses' },
            ...NOTIFICATION_LOG_STATUSES.map((s) => ({
              value: s,
              label: s.charAt(0) + s.slice(1).toLowerCase(),
            })),
          ]}
        />
      </Toolbar>
      <ErrorNote error={retry.error} />
      <DataTable
        columns={[
          {
            header: 'Email',
            cell: (e) => (
              <span className="font-medium">
                {e.subject ?? e.template.replaceAll('_', ' ').toLowerCase()}
              </span>
            ),
          },
          {
            header: 'To',
            cell: (e) => <span className="text-muted-foreground">{e.recipient}</span>,
          },
          {
            header: 'Status',
            cell: (e) => (
              <span className="grid gap-0.5">
                <Badge
                  variant={
                    e.status === 'FAILED'
                      ? 'destructive'
                      : e.status === 'QUEUED'
                        ? 'soft'
                        : 'outline'
                  }
                >
                  {e.status.toLowerCase()}
                </Badge>
                {(e.lastError ?? e.suppressedReason) && (
                  <span className="text-xs text-muted-foreground">
                    {e.lastError ?? e.suppressedReason}
                  </span>
                )}
              </span>
            ),
          },
          { header: 'Attempts', className: 'text-right tabular-nums', cell: (e) => e.attempts },
          { header: 'Created', cell: (e) => formatDateTime(e.createdAt) },
          {
            header: '',
            cell: (e) =>
              e.resendable ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retry.isPending}
                  onClick={() => {
                    retry.mutate(e.id);
                  }}
                >
                  Retry
                </Button>
              ) : null,
          },
        ]}
        rows={log.data?.items}
        rowKey={(e) => e.id}
        loading={log.isPending}
        error={log.error}
        empty="No emails match."
      />
      {log.data && (
        <Pagination
          page={page}
          pageSize={log.data.pageSize}
          total={log.data.total}
          onPage={setPage}
        />
      )}
    </>
  );
}
