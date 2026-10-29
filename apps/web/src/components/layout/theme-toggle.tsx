'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useI18n } from '@/components/i18n/provider';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { t } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
      }}
      aria-label={t.layout.toggleTheme}
    >
      {/* Both icons render; CSS picks one, so there is no hydration mismatch. */}
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}
