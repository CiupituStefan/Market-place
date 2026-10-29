import { getI18n } from '@/lib/i18n/server';
import { CheckoutView } from '@/components/cart/checkout-view';
import { localPrivatePage } from '@/lib/seo/private';

export const generateMetadata = localPrivatePage((t) => t.pages.checkout);

export default async function CheckoutPage() {
  const { t } = await getI18n();
  return (
    <div className="container-page py-10">
      <h1 className="mb-10 text-4xl font-semibold tracking-tight">{t.pages.checkout}</h1>
      <CheckoutView />
    </div>
  );
}
