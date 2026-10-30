import { getI18n } from '@/lib/i18n/server';
import { CartView } from '@/components/cart/cart-view';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.cart);

export default async function CartPage() {
  const { t } = await getI18n();
  return (
    <div className="container-page py-10">
      <h1 className="display mb-10 text-[clamp(3rem,7vw,6.5rem)]">{t.pages.cart}</h1>
      <CartView />
    </div>
  );
}
