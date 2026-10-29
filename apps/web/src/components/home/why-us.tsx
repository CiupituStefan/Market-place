import { PackageCheckIcon, ShieldCheckIcon, SlidersHorizontalIcon, WrenchIcon } from 'lucide-react';
import { getI18n } from '@/lib/i18n/server';

const ICONS = [SlidersHorizontalIcon, WrenchIcon, ShieldCheckIcon, PackageCheckIcon];

export async function WhyUs() {
  const { t } = await getI18n();
  const reasons = t.home.why.reasons.map((reason, index) => ({
    ...reason,
    icon: ICONS[index] ?? PackageCheckIcon,
  }));
  return (
    <ul className="grid gap-px overflow-hidden rounded-3xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {reasons.map(({ icon: Icon, title, body }) => (
        <li key={title} className="bg-card p-8">
          <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-soft text-foreground">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <h3 className="mt-6 font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </li>
      ))}
    </ul>
  );
}
