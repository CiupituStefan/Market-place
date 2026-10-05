import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { products } from '@/lib/catalog/fixtures';
import { ProductCard } from './product-card';

describe('ProductCard', () => {
  it('links to the product and shows price, rating and badges', () => {
    const nimbus = products.find((p) => p.slug === 'cse-nimbus-65')!;
    render(<ProductCard product={nimbus} />);
    expect(screen.getByRole('link', { name: 'CSE Nimbus 65' })).toHaveAttribute(
      'href',
      '/product/cse-nimbus-65',
    );
    expect(screen.getByText('€149.00')).toBeInTheDocument();
    expect(screen.getByText('€169.00')).toBeInTheDocument();
    expect(screen.getByText('−12%')).toBeInTheDocument();
    expect(screen.getByText('Sale')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'CSE Nimbus 65' })).toBeInTheDocument();
  });
});
