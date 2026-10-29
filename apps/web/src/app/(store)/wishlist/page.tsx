import { getI18n } from '@/lib/i18n/server';
import { WishlistView } from '@/components/account/wishlist-view';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.wishlist);

export default async function WishlistPage() {
  const { t } = await getI18n();
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">{t.pages.wishlist}</h1>
      <WishlistView />
    </div>
  );
}
