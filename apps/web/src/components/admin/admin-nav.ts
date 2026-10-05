import {
  BarChart3Icon,
  BoxesIcon,
  LayoutDashboardIcon,
  MessageSquareTextIcon,
  PackageIcon,
  ReceiptIcon,
  TicketPercentIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const adminNav: AdminNavItem[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboardIcon,
    description: 'Today at a glance.',
  },
  {
    href: '/admin/products',
    label: 'Products',
    icon: PackageIcon,
    description: 'Catalog, variants, prices and images.',
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    icon: ReceiptIcon,
    description: 'Fulfilment, shipping and refunds.',
  },
  {
    href: '/admin/inventory',
    label: 'Inventory',
    icon: BoxesIcon,
    description: 'Stock, reservations and movements.',
  },
  {
    href: '/admin/users',
    label: 'Customers',
    icon: UsersIcon,
    description: 'Accounts, orders and reviews per customer.',
  },
  {
    href: '/admin/reviews',
    label: 'Reviews',
    icon: MessageSquareTextIcon,
    description: 'Moderate product reviews.',
  },
  {
    href: '/admin/discounts',
    label: 'Discounts',
    icon: TicketPercentIcon,
    description: 'Coupons, limits and expiry.',
  },
  {
    href: '/admin/analytics',
    label: 'Analytics',
    icon: BarChart3Icon,
    description: 'Revenue, AOV and best sellers.',
  },
];
