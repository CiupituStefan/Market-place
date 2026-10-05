'use client';

import type { DateRange } from '@/lib/api/admin';
import { cn } from '@/lib/utils';

/** The store reports in its own time zone (admin-service ANALYTICS_TIME_ZONE). */
export const STORE_TIME_ZONE = 'Europe/Bucharest';

export function storeToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE }).format(now);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export const RANGE_PRESETS = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: '365d', label: '12 months', days: 365 },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]['key'];

export function presetRange(key: RangePreset, today = storeToday()): DateRange {
  const preset = RANGE_PRESETS.find((p) => p.key === key) ?? RANGE_PRESETS[2];
  return { from: addDays(today, -(preset.days - 1)), to: today };
}

/** Preset row: the one filter every report starts with. */
export function RangePicker({
  value,
  onChange,
}: {
  value: RangePreset;
  onChange: (value: RangePreset) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Date range"
      className="flex flex-wrap gap-1 rounded-xl border bg-card p-1"
    >
      {RANGE_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          role="radio"
          aria-checked={value === preset.key}
          onClick={() => {
            onChange(preset.key);
          }}
          className={cn(
            'rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
            value === preset.key && 'bg-secondary font-semibold text-foreground',
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
