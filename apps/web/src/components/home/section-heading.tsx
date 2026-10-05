import { ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  href?: string;
  linkLabel?: string;
  id?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  linkLabel,
  id,
}: SectionHeadingProps) {
  return (
    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          {title}
        </h2>
        {description && <p className="mt-3 text-muted-foreground text-pretty">{description}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium"
        >
          {linkLabel ?? 'View all'}
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
