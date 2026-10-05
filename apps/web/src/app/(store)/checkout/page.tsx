import { CheckoutView } from '@/components/cart/checkout-view';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Checkout');

export default function CheckoutPage() {
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutView />
    </div>
  );
}
