import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { products } from '@/lib/catalog/fixtures';
import { VariantPicker } from './variant-picker';

const forge = products.find((p) => p.slug === 'cse-forge-75')!;

describe('VariantPicker', () => {
  it('marks the selected values and unavailable combinations', () => {
    render(
      <VariantPicker
        product={forge}
        selection={{ color: 'chalk', switch: 'linear' }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Chalk' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Crisp Clicky \(unavailable/ })).toBeInTheDocument();
  });

  it('reports selections', () => {
    const onSelect = vi.fn();
    render(
      <VariantPicker
        product={forge}
        selection={{ color: 'carbon', switch: 'linear' }}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Ember Tactile/ }));
    expect(onSelect).toHaveBeenCalledWith('switch', 'tactile');
  });
});
