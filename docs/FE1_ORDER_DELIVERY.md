# FE1: login, customer orders and delivery progress

## Delivered

- Existing Order Management continues to show PREPARING, OUT_FOR_DELIVERY and DELIVERED. Staff order details now show a progress indicator, Dispatch loading/empty/error states, related trips, drivers, vehicles and full delivery attempt history (including failure reasons and subsequent successful attempts).
- The staff history view uses existing `GET /api/v1/delivery/trips`, filters assignments for the order, and loads `GET /api/v1/delivery/trips/{tripId}/orders/{orderId}/attempts`. A trip link opens `/delivery?tripId=...`. Details/history refresh every 15 seconds; the order list retains its existing 30-second refresh.
- CUSTOMER accounts can sign in using the existing login API. `/shop/orders` lists their own orders; `/shop/orders/:id` displays a read-only order and delivery status. These screens call only the current-customer order resources and the public product catalog. They never request staff delivery/dispatch resources.
- The management route guard redirects customers to their own workspace before mounting staff screens. Customer routes require authentication. A customer is no longer mapped to the sales staff fallback role. Login destinations and account menu links respect the authenticated role.
- Authenticated customer checkout uses `POST /api/v1/customer/orders`, so new orders belong to the signed-in customer. Anonymous checkout retains `/customer/orders/guest`. The server derives ownership; the frontend does not submit a customer id. Successful customer checkout links to the saved order.
- Session caches are cleared on account changes; an outdated `/auth/me` response cannot overwrite a newer session.

## Existing API boundaries

- Customer order detail/list endpoints already enforce ownership. Their list endpoint returns 404 if the user has no customer profile; the FE presents that as an empty list. Detail 403/404 shows a non-disclosing not-found screen. Other errors remain visible and retryable.
- The CUSTOMER view displays the order status and timestamps available in its order DTO. Full attempt history and internal trip/Dispatch metadata are staff-only because the current backend does not expose a customer-safe delivery-history resource. No staff resource is opened to customers as a workaround.
- Customer self-registration was added subsequently; see [Customer registration](CUSTOMER_REGISTRATION.md). Public guest order tracking remains disabled. Guest orders are not automatically linked by email/phone.
- No backend changes or Flyway migrations are introduced. Dispatch, inventory, payments and redelivery business rules are unchanged.

## Validation

Run `npm run lint`, `npm test` and `npm run build` from `frontend`.

The FE1 tests cover role redirects, customer login, identity-scoped API requests, authenticated checkout payloads, status progression, history filtering/ordering, failure reasons, trip links, customer read-only screens, empty states, unavailable orders and retry behavior. UI tests use jsdom and React Testing Library with mocked API boundaries; they are not a replacement for a real-browser end-to-end run against deployed customer accounts.
