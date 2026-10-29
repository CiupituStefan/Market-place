'use client';

import { SHIPPING_COUNTRIES } from '@market/types';
import { useId } from 'react';
import { FormField } from '@/components/auth/form-field';
import { useI18n } from '@/components/i18n/provider';
import { Label } from '@/components/ui/label';
import { LOCALE_INFO } from '@/lib/i18n/config';
import type { FieldErrors } from '@/lib/auth/validation';

/** Address inputs named `${prefix}.field`; errors are keyed the same way. */
export function AddressFields({
  prefix,
  errors,
  defaultCountry = 'RO',
}: {
  prefix: 'shippingAddress' | 'billingAddress';
  errors: FieldErrors;
  defaultCountry?: string;
}) {
  const countryId = useId();
  const { t, locale } = useI18n();
  const copy = t.checkout.address;
  // Country names in the page's language, sorted for it.
  const intl = LOCALE_INFO[locale].intl;
  const names = new Intl.DisplayNames([intl], { type: 'region' });
  const countries = Object.entries(SHIPPING_COUNTRIES)
    .map(([code, english]) => [code, names.of(code) ?? english] as const)
    .sort((a, b) => a[1].localeCompare(b[1], intl));
  const name = (field: string) => `${prefix}.${field}`;
  const auto = (token: string) =>
    `${prefix === 'billingAddress' ? 'billing' : 'shipping'} ${token}`;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={copy.firstName}
          name={name('firstName')}
          autoComplete={auto('given-name')}
          required
          error={errors[name('firstName')]}
        />
        <FormField
          label={copy.lastName}
          name={name('lastName')}
          autoComplete={auto('family-name')}
          required
          error={errors[name('lastName')]}
        />
      </div>
      <FormField
        label={copy.company}
        name={name('company')}
        autoComplete={auto('organization')}
        error={errors[name('company')]}
      />
      <FormField
        label={copy.line1}
        name={name('line1')}
        autoComplete={auto('address-line1')}
        required
        error={errors[name('line1')]}
      />
      <FormField
        label={copy.line2}
        name={name('line2')}
        autoComplete={auto('address-line2')}
        error={errors[name('line2')]}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <FormField
          label={copy.city}
          name={name('city')}
          autoComplete={auto('address-level2')}
          required
          error={errors[name('city')]}
        />
        <FormField
          label={copy.postalCode}
          name={name('postalCode')}
          autoComplete={auto('postal-code')}
          required
          error={errors[name('postalCode')]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={countryId}>{copy.country}</Label>
          <select
            id={countryId}
            name={name('country')}
            autoComplete={auto('country')}
            defaultValue={defaultCountry}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            {countries.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <FormField
          label={copy.phone}
          name={name('phone')}
          type="tel"
          autoComplete={auto('tel')}
          hint={copy.phoneHint}
          error={errors[name('phone')]}
        />
      </div>
    </div>
  );
}

/** Reads an AddressFields group from FormData; empty optional fields become null. */
export function readAddress(data: FormData, prefix: 'shippingAddress' | 'billingAddress') {
  const text = (field: string) => {
    const value = data.get(`${prefix}.${field}`);
    return typeof value === 'string' ? value.trim() : '';
  };
  const optional = (field: string) => text(field) || null;
  return {
    firstName: text('firstName'),
    lastName: text('lastName'),
    company: optional('company'),
    line1: text('line1'),
    line2: optional('line2'),
    city: text('city'),
    postalCode: text('postalCode'),
    region: null,
    country: text('country'),
    phone: optional('phone'),
  };
}
