# web

Next.js (App Router) storefront + `/admin` dashboard.

> Built in **Phase 2** (frontend shell) and **Phase 13** (admin dashboard). This folder is intentionally
> not a workspace package yet: pnpm only picks it up once `package.json` exists.

Rules that already apply:

- The frontend never decides prices, totals, stock or payment status. It renders what the API returns.
- All API traffic goes through `api-gateway` (`/api/v1/*`).
- Shared contracts come from `@market/types` (error format, money, roles).
