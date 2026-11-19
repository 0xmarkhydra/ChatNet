---
document_id: BE-MKT-001
title: Marketplace Backend Foundation
version: 1.0.0
status: Draft
owner: Commerce Engineering
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# Marketplace Backend Foundation

## Tóm tắt

Phần nền hiện tạo nháp, công bố, xử lý giỏ và lưu yêu cầu đơn. Trạng thái chờ cấu hình thanh toán không tạo giao dịch thật. Chưa suy diễn AI đăng bán, vận chuyển hay hoàn tiền.

## 1. Status

Marketplace is a subdomain implemented inside the Feed service. The committed source contains a backend foundation for product drafts, publishing, listing, cart management and pending-payment order requests.

It is **not** a complete production marketplace. Payment collection, seller fulfillment, shipment, refund, dispute and AI-first listing workflows are not established by this source baseline.

## 2. Data model

The base schema defines:
- market_products: seller, title, description, price amount/unit, stock and listing status;
- market_cart_items: buyer/product/quantity;
- market_orders: buyer, seller, idempotency key, total, price unit and payment-configuration status;
- market_order_items: order and product references with title/price/quantity snapshots.

The market_orders status constraint in the current schema is awaiting_payment_configuration. This is a deliberate guard, not a synonym for paid or accepted.

## 3. HTTP operations

All routes below are registered by [mountMarketplace](../../backend/cmd/feed/marketplace.go) and use `authx.Middleware` for bearer JWT verification, not `CachedSessionMiddleware` for active-session state. This is a source boundary, not an endorsement. See the [Auth caveat](AUTHENTICATION_AND_SESSIONS.md#3-login-and-session-lifecycle).

| Method | Path | Behavior |
|---|---|---|
| GET | /api/marketplace/products | List published products |
| GET | /api/marketplace/products/mine | List seller-owned products |
| POST | /api/marketplace/products | Create product draft |
| POST | /api/marketplace/products/{id}/publish | Publish an owned draft |
| GET | /api/marketplace/cart | Read buyer cart |
| PUT | /api/marketplace/cart/{id} | Add/update cart quantity |
| DELETE | /api/marketplace/cart/{id} | Remove cart item |
| POST | /api/marketplace/orders | Create or retrieve idempotent order request |
| GET | /api/marketplace/orders | List buyer order requests |

## 4. Transaction and validation behavior

The source validates product identifiers, pagination bounds, body size and JSON fields. Cart updates require a published product, a different seller from the buyer and sufficient stock for the requested quantity. Checkout uses a transaction and a buyer-scoped idempotency key to avoid duplicate order creation. The lookup uses buyer and key, not a fingerprint of the cart or seller. Reuse the key only for a retry of the same operation. Use a new key for a different checkout. Order items snapshot product title, price and quantity.

These implementation details do not establish stock reservation or a completed commercial checkout.

## 5. Payment and order-state boundary

Current checkout returns status awaiting_payment_configuration. The implementation does not:
- collect or reconcile real money;
- deduct Coin or Point;
- mark an order paid;
- reserve or decrement inventory as a completed sale;
- send a seller fulfillment notification;
- create shipment or refund records;
- settle seller revenue.

Do not infer a payment method from price_unit. It is a product price unit field, not proof of an approved financial instrument.

## 6. AI-first seller workflow

The historical AI-first marketplace specification describes a chat-driven seller assistant, AI-generated draft suggestions, seller confirmation, tool allowlists, media attachment and listing edits. This is a product proposal. The source baseline does not establish that AI can create/publish products through the proposed tool workflow.

Any future AI listing agent must not access the database or object store directly, must use allowlisted backend operations, validate ownership and fields, require explicit seller confirmation before publishing, and remain safe under prompt injection and retries.

## 7. Release blockers

Before commercial launch, the product owner must approve:
- payment provider and currency;
- payment state machine and webhook trust model;
- inventory reservation and concurrency policy;
- seller fulfillment, shipment and returns;
- cancellation, dispute and refund rules;
- tax, consumer protection and applicable legal review;
- seller moderation and fraud controls;
- reconciliation and audit reporting.

See [Point/Coin product specification](POINT_COIN_PRODUCT_SPEC.md) for a separate economic feature proposal. Marketplace payment must not assume Coin is the chosen payment rail.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
