# Plans and sign-up payment

Ecomesta has three plans (Starter ৳99, Growth ৳299, Business ৳699 a month;
6-month and yearly periods save 10% and 25%). There is **no free trial**:
since migration `20261006090000_paid_onboarding` every plan has
`trialMonths: 0` and `DEFAULT_TRIAL_MONTHS` is 0.

## Signing up

1. The merchant registers, then fills in the store details and chooses a plan
   and billing period (`/onboard`, step 2 of 3).
2. Step 3 is the payment: they send the plan price with bKash, Nagad, Rocket or
   Upay to the Ecomesta number shown, then enter their number and the
   transaction ID.
3. `POST /onboarding/store` takes the store details, `planSlug`,
   `billingCycle`, `method`, `senderNumber` and `transactionId`, all required.
   In one transaction it creates the tenant, the store and a `PENDING`
   `BillingPayment` (amount from the plan, never from the client), and queues
   the billing-inbox email. Invalid wallet details or a transaction ID used
   before are refused and nothing is created.
4. The store is created `INACTIVE` with `awaiting_first_payment = true`:
   shoppers get a 404, but the merchant can already add products. The
   dashboard shows "Your store is not live yet". No subscription exists yet.

## Approval

- A Super Admin approves the payment in **Admin → Payments**. The approval
  creates the subscription, activates it for the paid period and brings every
  store waiting for its first payment online (`INACTIVE` → `ACTIVE`, flag
  cleared). A store a Super Admin suspended meanwhile stays suspended.
- A rejected payment leaves the store offline. The merchant sees the reason in
  Plan & billing and pays again there (`POST /billing/payments`); approving that
  payment brings the store online.
- A business without a subscription cannot start a plan without paying:
  `POST /billing/subscription` answers 402.

## Businesses already on a free trial

Subscriptions that were `TRIALING` before trials ended keep their
`trial_ends_at`. They still follow trial → 7-day grace → suspension, and may
switch to the same or a cheaper plan during the trial.
