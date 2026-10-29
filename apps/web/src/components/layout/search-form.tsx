'use client';

import { SearchIcon } from 'lucide-react';
import Form from 'next/form';
import { useI18n } from '@/components/i18n/provider';
import { cn } from '@/lib/utils';

/** Plain GET form: works without JavaScript and is progressively enhanced by next/form. */
export function SearchForm({
  className,
  defaultValue,
}: {
  className?: string;
  defaultValue?: string;
}) {
  const { t, path } = useI18n();
  return (
    <Form action={path('/search')} role="search" className={cn('relative', className)}>
      <label htmlFor="site-search" className="sr-only">
        {t.layout.search}
      </label>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id="site-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={t.layout.searchPlaceholder}
        autoComplete="off"
        maxLength={100}
        className="h-10 w-full rounded-full border border-input bg-secondary/60 pr-4 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/40"
      />
    </Form>
  );
}
