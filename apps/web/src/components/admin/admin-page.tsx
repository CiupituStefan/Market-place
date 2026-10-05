import type { ReactNode } from 'react';

export function AdminPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

/** Table frame with headers; rows arrive from admin-service in the admin phase. */
export function AdminTable({ columns, empty }: { columns: string[]; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-secondary/50 text-xs text-muted-foreground uppercase">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-4 py-3 font-medium tracking-wide">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length} className="px-4 py-16 text-center text-muted-foreground">
              {empty}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
