'use client';

import {
  BestSellersSchema,
  CategorySchema,
  CustomerStatsSchema,
  DailySalesSchema,
  DiscountCodeSchema,
  ManagedProductSummarySchema,
  NotificationLogSchema,
  OrderSchema,
  OrderSummarySchema,
  PaymentSchema,
  ProductReviewSchema,
  ProductSchema,
  ProductStatusSchema,
  ReservationSchema,
  SalesSummarySchema,
  StockItemSchema,
  StockMovementSchema,
  UserAccountSchema,
  type DiscountType,
  type OrderStatus,
  type ProductStatus,
  type RefundReason,
  type ReviewStatus,
  type Role,
} from '@market/types';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { z } from 'zod';
import { api } from './browser';

/**
 * Back-office data. Every call goes through the gateway to the service that owns
 * the data (STAFF/ADMIN enforced there); responses are validated like any other.
 */

const page = <S extends z.ZodType>(item: S) =>
  z.object({
    items: z.array(item),
    page: z.int(),
    pageSize: z.int(),
    total: z.int(),
    totalPages: z.int().optional(),
  });
/** Empty search boxes send no filter. */
const nonEmpty = (value: string | undefined) => (value === '' ? undefined : value);

const empty = z.unknown();

/** Mutation that refreshes the given query families when it succeeds. */
function useAdminMutation<TInput, TResult>(
  fn: (input: TInput) => Promise<TResult>,
  invalidate: QueryKey[],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

// ── analytics (admin-service) ────────────────────────────────────────────────

export interface DateRange {
  from: string;
  to: string;
}

export function useSalesSummary(range: DateRange) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'summary', range],
    queryFn: () =>
      api('/admin/analytics/summary', { schema: SalesSummarySchema, query: { ...range } }),
    placeholderData: keepPreviousData,
  });
}

export function useDailySales(range: DateRange) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'daily', range],
    queryFn: () => api('/admin/analytics/daily', { schema: DailySalesSchema, query: { ...range } }),
    placeholderData: keepPreviousData,
  });
}

export function useBestSellers(range: DateRange, limit = 10) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'best-sellers', range, limit],
    queryFn: () =>
      api('/admin/analytics/best-sellers', {
        schema: BestSellersSchema,
        query: { ...range, limit },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerStats(userId: string) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'customer', userId],
    queryFn: () => api(`/admin/analytics/customers/${userId}`, { schema: CustomerStatsSchema }),
  });
}

// ── orders and payments ─────────────────────────────────────────────────────

export function useAdminOrders(filter: {
  status?: OrderStatus | undefined;
  q?: string | undefined;
  userId?: string | undefined;
  page: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['admin', 'orders', filter],
    queryFn: () =>
      api('/orders/manage', {
        schema: page(OrderSummarySchema),
        query: { pageSize: 20, ...filter, q: nonEmpty(filter.q) },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminOrder(id: string) {
  return useQuery({
    queryKey: ['admin', 'orders', id],
    queryFn: () => api(`/orders/manage/${id}`, { schema: OrderSchema }),
  });
}

export interface StatusChange {
  status: 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string | null;
  note?: string | null;
}

export function useChangeOrderStatus(id: string) {
  return useAdminMutation(
    (body: StatusChange) =>
      api(`/orders/manage/${id}/status`, { method: 'POST', body, schema: OrderSchema }),
    [
      ['admin', 'orders'],
      ['admin', 'payments', id],
    ],
  );
}

export function useOrderPayments(orderId: string) {
  return useQuery({
    queryKey: ['admin', 'payments', orderId],
    queryFn: () => api('/payments/manage', { schema: z.array(PaymentSchema), query: { orderId } }),
  });
}

export function useRefund(orderId: string) {
  return useAdminMutation(
    (input: {
      paymentId: string;
      amount?: number;
      reason: Exclude<RefundReason, 'order_unfulfillable'>;
    }) =>
      api(`/payments/manage/${input.paymentId}/refunds`, {
        method: 'POST',
        body: { amount: input.amount, reason: input.reason },
        schema: PaymentSchema,
      }),
    [
      ['admin', 'payments', orderId],
      ['admin', 'orders'],
    ],
  );
}

// ── catalog ──────────────────────────────────────────────────────────────────

export const ManagedProductSchema = ProductSchema.extend({ status: ProductStatusSchema });
export type ManagedProduct = z.infer<typeof ManagedProductSchema>;

export function useAdminProducts(filter: {
  status?: ProductStatus | undefined;
  q?: string | undefined;
  page: number;
}) {
  return useQuery({
    queryKey: ['admin', 'products', filter],
    queryFn: () =>
      api('/products/manage', {
        schema: page(ManagedProductSummarySchema),
        query: { pageSize: 20, ...filter, q: nonEmpty(filter.q) },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminProduct(id: string) {
  return useQuery({
    queryKey: ['admin', 'products', id],
    queryFn: () => api(`/products/manage/${id}`, { schema: ManagedProductSchema }),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api('/categories', { schema: z.array(CategorySchema) }),
    staleTime: 5 * 60_000,
  });
}

const productKeys = (id?: string): QueryKey[] =>
  id
    ? [
        ['admin', 'products'],
        ['admin', 'products', id],
      ]
    : [['admin', 'products']];

export function useCreateProduct() {
  return useAdminMutation(
    (body: Record<string, unknown>) =>
      api('/products', { method: 'POST', body, schema: z.object({ id: z.uuid() }) }),
    productKeys(),
  );
}

export function useUpdateProduct(id: string) {
  return useAdminMutation(
    (body: Record<string, unknown>) =>
      api(`/products/${id}`, { method: 'PATCH', body, schema: empty }),
    productKeys(id),
  );
}

export function useProductStatus(id: string) {
  return useAdminMutation((action: 'publish' | 'unpublish' | 'archive') => {
    if (action === 'archive') return api(`/products/${id}`, { method: 'DELETE', schema: empty });
    return api(`/products/${id}/${action}`, { method: 'POST', schema: empty });
  }, productKeys(id));
}

export function useAddVariant(productId: string) {
  return useAdminMutation(
    (body: Record<string, unknown>) =>
      api(`/products/${productId}/variants`, {
        method: 'POST',
        body,
        schema: z.object({ id: z.uuid() }),
      }),
    productKeys(productId),
  );
}

export function useUpdateVariant(productId: string) {
  return useAdminMutation(
    (input: { variantId: string; body: Record<string, unknown> }) =>
      api(`/products/${productId}/variants/${input.variantId}`, {
        method: 'PATCH',
        body: input.body,
        schema: empty,
      }),
    productKeys(productId),
  );
}

export function useRemoveVariant(productId: string) {
  return useAdminMutation(
    (variantId: string) =>
      api(`/products/${productId}/variants/${variantId}`, { method: 'DELETE', schema: empty }),
    productKeys(productId),
  );
}

const UploadFormSchema = z.object({
  url: z.string(),
  fields: z.record(z.string(), z.string()),
  key: z.string(),
});

/** Pre-signed S3 upload, then registration: image bytes never touch our services. */
export function useUploadImage(productId: string) {
  return useAdminMutation(async (input: { file: File; alt: string; variantId: string | null }) => {
    const form = await api(`/products/${productId}/images/upload-url`, {
      method: 'POST',
      body: { contentType: input.file.type },
      schema: UploadFormSchema,
    });
    const { width, height } = await imageSize(input.file);
    const body = new FormData();
    for (const [name, value] of Object.entries(form.fields)) body.append(name, value);
    body.append('file', input.file);
    const upload = await fetch(form.url, { method: 'POST', body });
    if (!upload.ok) throw new Error('The image could not be uploaded to storage');
    return api(`/products/${productId}/images`, {
      method: 'POST',
      body: { key: form.key, alt: input.alt, width, height, variantId: input.variantId },
      schema: empty,
    });
  }, productKeys(productId));
}

function imageSize(file: File): Promise<{ width: number; height: number }> {
  return createImageBitmap(file).then((bitmap) => {
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  });
}

export function useRemoveImage(productId: string) {
  return useAdminMutation(
    (imageId: string) =>
      api(`/products/${productId}/images/${imageId}`, { method: 'DELETE', schema: empty }),
    productKeys(productId),
  );
}

// ── inventory ────────────────────────────────────────────────────────────────

export function useStock(filter: { q?: string | undefined; lowStock?: boolean; page: number }) {
  return useQuery({
    queryKey: ['admin', 'inventory', filter],
    queryFn: () =>
      api('/inventory', {
        schema: page(StockItemSchema),
        query: {
          pageSize: 25,
          page: filter.page,
          q: nonEmpty(filter.q),
          lowStock: filter.lowStock ? 1 : undefined,
        },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useReservations(status: Reservation['status'] | undefined) {
  return useQuery({
    queryKey: ['admin', 'inventory', 'reservations', status],
    queryFn: () =>
      api('/inventory/reservations', {
        schema: z.array(ReservationSchema),
        query: { status, limit: 100 },
      }),
  });
}
type Reservation = z.infer<typeof ReservationSchema>;

export function useMovements(variantId: string | null) {
  return useQuery({
    queryKey: ['admin', 'inventory', 'movements', variantId],
    queryFn: () =>
      api(`/inventory/${variantId ?? ''}/movements`, { schema: z.array(StockMovementSchema) }),
    enabled: variantId !== null,
  });
}

export function useAdjustStock() {
  return useAdminMutation(
    (input: {
      variantId: string;
      type: 'RECEIVED' | 'ADJUSTMENT';
      delta: number;
      reason: string;
    }) =>
      api(`/inventory/${input.variantId}/adjustments`, {
        method: 'POST',
        body: { type: input.type, delta: input.delta, reason: input.reason },
        schema: StockItemSchema,
      }),
    [['admin', 'inventory']],
  );
}

export function useSetThreshold() {
  return useAdminMutation(
    (input: { variantId: string; lowStockThreshold: number }) =>
      api(`/inventory/${input.variantId}`, {
        method: 'PATCH',
        body: { lowStockThreshold: input.lowStockThreshold },
        schema: StockItemSchema,
      }),
    [['admin', 'inventory']],
  );
}

// ── customers ────────────────────────────────────────────────────────────────

export function useAdminUsers(filter: { q?: string | undefined; page: number }) {
  return useQuery({
    queryKey: ['admin', 'users', filter],
    queryFn: () =>
      api('/users', {
        schema: page(UserAccountSchema),
        query: { pageSize: 25, page: filter.page, q: nonEmpty(filter.q) },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: ['admin', 'users', id],
    queryFn: () => api(`/users/${id}`, { schema: UserAccountSchema }),
  });
}

export function useUpdateRoles(id: string) {
  return useAdminMutation(
    (roles: Role[]) =>
      api(`/users/${id}/roles`, { method: 'PATCH', body: { roles }, schema: UserAccountSchema }),
    [['admin', 'users']],
  );
}

// ── reviews ──────────────────────────────────────────────────────────────────

export const ModeratedReviewSchema = ProductReviewSchema.extend({
  moderationNote: z.string().nullable(),
  reportCount: z.int(),
});
export type ModeratedReview = z.infer<typeof ModeratedReviewSchema>;

export function useModerationQueue(filter: {
  status?: ReviewStatus | undefined;
  userId?: string | undefined;
  page: number;
}) {
  return useQuery({
    queryKey: ['admin', 'reviews', filter],
    queryFn: () =>
      api('/reviews/manage', {
        schema: page(ModeratedReviewSchema),
        query: { pageSize: 20, ...filter },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useModerateReview() {
  return useAdminMutation(
    (input: { id: string; status: ReviewStatus; note: string | null }) =>
      api(`/reviews/manage/${input.id}/status`, {
        method: 'POST',
        body: { status: input.status, note: input.note },
        schema: empty,
      }),
    [['admin', 'reviews']],
  );
}

// ── discounts ────────────────────────────────────────────────────────────────

export function useDiscounts() {
  return useQuery({
    queryKey: ['admin', 'discounts'],
    queryFn: () => api('/discounts', { schema: z.array(DiscountCodeSchema) }),
  });
}

export interface DiscountInput {
  code?: string;
  type: DiscountType;
  value: number;
  minSubtotal: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  usageLimit: number | null;
  perCustomerLimit: number | null;
  active: boolean;
}

export function useSaveDiscount() {
  return useAdminMutation(
    ({ id, ...body }: DiscountInput & { id?: string }) =>
      id
        ? api(`/discounts/${id}`, { method: 'PATCH', body, schema: DiscountCodeSchema })
        : api('/discounts', { method: 'POST', body, schema: DiscountCodeSchema }),
    [['admin', 'discounts']],
  );
}

// ── emails ───────────────────────────────────────────────────────────────────

export function useEmailLog(filter: {
  status?: string | undefined;
  recipient?: string | undefined;
  page: number;
}) {
  return useQuery({
    queryKey: ['admin', 'emails', filter],
    queryFn: () =>
      api('/notifications/manage/logs', {
        schema: page(NotificationLogSchema),
        query: { pageSize: 25, ...filter, recipient: nonEmpty(filter.recipient) },
      }),
    placeholderData: keepPreviousData,
  });
}

export function useRetryEmail() {
  return useAdminMutation(
    (id: string) =>
      api(`/notifications/manage/logs/${id}/retry`, {
        method: 'POST',
        schema: NotificationLogSchema,
      }),
    [['admin', 'emails']],
  );
}
