/**
 * Static informational pages. Legal texts are placeholders that must be reviewed
 * by counsel before launch; they will move to a CMS later.
 */
export interface ContentPage {
  title: string;
  description: string;
  sections: { heading: string; body: string }[];
}

export const contentPages: Record<string, ContentPage> = {
  shipping: {
    title: 'Shipping',
    description: 'Delivery times, costs and tracking for CSE Keyboards orders.',
    sections: [
      {
        heading: 'Dispatch',
        body: 'Orders placed before 14:00 CET on business days ship the same day. Pre-orders ship when stock arrives; the expected date is shown on the product page.',
      },
      {
        heading: 'Costs',
        body: 'Tracked shipping is free within the EU on orders over €99. Below that, and for express delivery, the exact cost is calculated at checkout before you pay.',
      },
      {
        heading: 'Tracking',
        body: 'You receive a tracking link by email as soon as your parcel leaves our warehouse. You can also follow it from your account under Orders.',
      },
    ],
  },
  returns: {
    title: 'Returns & warranty',
    description: '30-day returns and a 2-year warranty on every keyboard.',
    sections: [
      {
        heading: '30-day returns',
        body: 'Unused items in their original packaging can be returned within 30 days of delivery. Start a return from your order page and we will email a prepaid label.',
      },
      {
        heading: 'Refunds',
        body: 'Refunds go back to the original payment method within 5 business days of the return being inspected.',
      },
      {
        heading: 'Warranty',
        body: 'Keyboards are covered for 2 years against manufacturing defects. Contact support with your order number and a short description or video of the issue.',
      },
    ],
  },
  about: {
    title: 'About CSE Keyboards',
    description: 'Who we are and how we build our keyboards.',
    sections: [
      {
        heading: 'Built by typists',
        body: 'CSE Keyboards started at a workbench with a soldering iron and too many switches. Today we design, tune and test every board in-house before it ships.',
      },
      {
        heading: 'How we build',
        body: 'Every keyboard is lubed, dampened and sound-tested. We use hot-swap PCBs and open firmware so your board can evolve with you.',
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    description: 'How CSE Keyboards handles your personal data.',
    sections: [
      {
        heading: 'What we collect',
        body: 'We collect the information needed to process your orders and run your account: name, email, shipping address and order history. Card details are entered directly into Stripe and never stored on our servers.',
      },
      {
        heading: 'Your rights',
        body: 'Under the GDPR you can access, correct, export or delete your data at any time. Contact support to exercise these rights.',
      },
    ],
  },
  terms: {
    title: 'Terms of sale',
    description: 'The terms that apply to purchases from CSE Keyboards.',
    sections: [
      {
        heading: 'Orders',
        body: 'An order is confirmed once payment has been successfully processed. Prices include VAT where applicable; the final amount is shown at checkout.',
      },
      {
        heading: 'Availability',
        body: 'Stock is reserved when you start payment. If a reservation expires before payment completes, the items return to stock.',
      },
    ],
  },
};
