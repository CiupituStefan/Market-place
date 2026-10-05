import { CartView } from '@/components/cart/cart-view';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Cart');

export default function CartPage() {
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">Cart</h1>
      <CartView />
    </div>
  );
}
