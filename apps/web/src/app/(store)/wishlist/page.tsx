import { WishlistView } from '@/components/account/wishlist-view';
import { privatePage } from '@/lib/seo/private';

export const metadata = privatePage('Wishlist');

export default function WishlistPage() {
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">Wishlist</h1>
      <WishlistView />
    </div>
  );
}
