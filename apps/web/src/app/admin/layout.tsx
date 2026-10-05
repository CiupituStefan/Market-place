import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { RequireStaff } from '@/components/admin/require-staff';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · CSE Admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background md:grid-cols-[15rem_1fr]">
      <AdminSidebar />
      <main id="main">
        <RequireStaff>{children}</RequireStaff>
      </main>
    </div>
  );
}
