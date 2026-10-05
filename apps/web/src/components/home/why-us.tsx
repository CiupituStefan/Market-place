import { PackageCheckIcon, ShieldCheckIcon, SlidersHorizontalIcon, WrenchIcon } from 'lucide-react';

const reasons = [
  {
    icon: SlidersHorizontalIcon,
    title: 'Tuned in-house',
    body: 'Every board is lubed, dampened and sound-tested by our team before it ships.',
  },
  {
    icon: WrenchIcon,
    title: 'Hot-swap everything',
    body: 'Change switches in seconds. No soldering, no voided warranty.',
  },
  {
    icon: ShieldCheckIcon,
    title: '2-year warranty',
    body: 'Real people answer support. Repairs and replacements are handled in the EU.',
  },
  {
    icon: PackageCheckIcon,
    title: 'Fast EU shipping',
    body: 'Free over €99, dispatched in 1–2 business days with tracking on every order.',
  },
];

export function WhyUs() {
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
