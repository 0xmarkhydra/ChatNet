---
document_id: PRD-ECON-001
title: Point and Coin Product Specification
version: 1.0.0
status: Draft
owner: Product and Finance
baseline_commit: 40c1f1b35958ee22c1278986bf82ff57520137a1
last_updated: 2026-11-19
normative_basis: "ISO/IEC/IEEE 12207:2026"
---

# Point and Coin Product Specification

## Tóm tắt

Point là điểm đóng góp, Coin là đơn vị tương tác có phí theo đặc tả. Không tự chốt giá, quy đổi hoặc gắn Coin vào Marketplace. Phần tài chính cần ledger và quyết định nghiệp vụ trước khi triển khai.

## 1. Status and authority

This document summarizes the product specification dated 2026-10-27. It is a product proposal and decision record, not evidence that Point/Coin wallets, ledgers, payments or payouts have been implemented.

The inspected baseline schema contains no Point or Coin ledger/balance tables and the API catalog contains no Point/Coin wallet endpoints.

## 2. Product distinction

The specification defines two distinct user-facing units:

| Attribute | Point | Coin |
|---|---|---|
| Nature | Recognition for activity and community contribution | Prepaid unit bought by a user for paid services/interactions |
| Sources | Eligible interactions, referrals and campaigns | Purchase/top-up through a payment partner |
| Intended uses | Future rewards, gifts, vouchers and offers | Virtual gifts and paid interactions |
| Conversion | No default conversion to Coin, cash, equity or token | Purchased Coin is not automatically withdrawable or transferable |
| Recipient income | Not an investment or guaranteed financial return | A recipient may receive separate VND income under an approved policy |

The specification explicitly separates the two units. Coin is intended as one common wallet unit for gifts and paid interactions; it is not a separate coin per feature. Recipient VND income is a separate platform payable, not a third user-tradable token.

## 3. Point product rules

Product-owner intent includes rewarding genuine participation and referrals while avoiding uncontrolled issuance. Campaign budgets, time windows, daily/per-user/action caps, eligibility, referral qualification, expiry and redemption policy remain to be defined.

Proposed controls include:
- a maximum campaign issuance budget;
- per-day/per-user/per-action limits;
- anti-bot, anti-spam and self-referral checks;
- unique event identifiers for idempotent credit;
- append-only history and reversal entries rather than deletion;
- anomaly alerts and an administrative campaign stop switch.

These controls are proposals until individually approved.

## 4. Coin paid-interaction rules

The product specification identifies these intended use cases:
- virtual gifts;
- paid messages;
- paid voice calls;
- paid video calls;
- paid comments.

The user should see the price and explicitly confirm before the charge. The recipient may enable/disable paid-interaction mode and set separate Coin prices for interaction types. Exact charging unit, exceptions, minimum/maximum prices and failure/refund behavior remain unresolved.

Paid-interaction mode does not override privacy settings, blocking, harassment controls, moderation or consent.

## 5. Accounting and payment safety proposals

The specification proposes separate ledgers for Point, Coin and VND revenue/payables. Coin top-ups would require verified payment webhooks and idempotent credit. Coin spending would require atomic balance checks and unique transaction IDs. Failed or declined interactions need explicit cancellation/refund policy. Recipient income would move through pending, available and withdrawn states only after the applicable checks.

These are design proposals, not current backend behavior.

## 6. Legal and product decisions still required

Before real top-up, paid interactions or payout:
1. approve the currency/price conversion and platform/recipient revenue split;
2. select a payment provider and webhook reconciliation model;
3. approve refund, dispute, chargeback and withdrawal policies;
4. define identity verification, fraud, tax and consumer-protection controls;
5. obtain legal review for the actual operating model and target market;
6. approve payout provider, thresholds, frequency and eligibility;
7. approve Point campaign budgets, limits, expiry and redemption terms.

No agent may invent prices, conversion rates, withdrawal limits, fees or legal conclusions.

## 7. Implementation boundary

No real-money operation, Coin deduction, Point credit, transfer, withdrawal or marketplace payment may be represented as available based only on this specification. The current Marketplace checkout state is awaiting_payment_configuration.

The original product specification remains at docs/CHATNET_POINT_COIN_PRODUCT_SPEC.md.

## Lịch sử thay đổi

- 1.0.0 (2026-11-19) — Chuẩn hóa nội dung và đối chiếu baseline.
