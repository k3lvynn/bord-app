# How to Set Up Your Stripe Account

## Step 1 — Create a Stripe Account
1. Go to https://stripe.com and click "Start now"
2. Enter your email, set a password
3. Verify your email
4. Fill in your business details (you can use "Individual" if you don't have a company yet)

## Step 2 — Activate your account (to receive real money)
1. In the Stripe dashboard, click "Activate your account" in the top banner
2. Fill in:
   - **Business type**: Individual or LLC/Corp
   - **Business website**: https://bord.app (or your domain)
   - **Business category**: Software / Apps
   - **Statement descriptor**: BORD APP (what attendees see on their bank statement)
3. Add your bank account for payouts
4. Provide your SSN (last 4 for basic, full for large payouts — required by law)
5. Submit for review — usually approved in minutes

## Step 3 — Get your API keys
1. Dashboard → Developers → API keys
2. You'll see:
   - **Publishable key**: starts with `pk_live_...` (safe to include in app)
   - **Secret key**: starts with `sk_live_...` ⚠️ NEVER put this in your app code

## Step 4 — Add keys to your project

### Publishable key (in .env):
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Secret key (in Supabase, NEVER in code):
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase functions deploy create-payment-intent
```

## Step 5 — Test before going live
Use Stripe test mode (toggle in dashboard top-right):
- Test publishable key: `pk_test_...`
- Test secret key: `sk_test_...`
- Test cards: 4242 4242 4242 4242 (any future date, any CVC)

## Step 6 — Platform fee (Bord takes 10%)
The current setup charges attendees `buy_in + 10%`.
The 10% goes to your Stripe account, minus Stripe's own fee (~2.9% + 30¢).
Net to Bord per $25 buy-in: ~$2.17

To pay out winners, you currently do it manually via Stripe dashboard or bank transfer.
Future: Stripe Connect allows automatic payouts to winners' bank accounts.

---

# Payout Structures — How They Work

Bord supports 6 payout structures for tournament events:

| Structure      | Splits           | Best For                        |
|----------------|------------------|---------------------------------|
| Winner Takes All | 100%           | Small brackets, high stakes     |
| Top 2          | 70% / 30%        | Most common for casual tourneys |
| Top 3          | 50% / 30% / 20%  | Larger brackets (8+ teams)      |
| Top 4          | 45% / 25% / 20% / 10% | Big events (16+ teams)   |
| Bounty         | 70% to winner + $X per elimination | Side-game feel |
| Custom         | You define        | Anything goes                   |

## Example: 16-person single elimination, $25 buy-in
- Gross collected: 16 × $25 = $400
- Platform fee (10%): $40
- **Prize pool: $360**

With "Top 3" payout:
- 🥇 1st: $180 (50%)
- 🥈 2nd: $108 (30%)
- 🥉 3rd: $72  (20%)

Bord shows these numbers to participants before they pay, so everyone knows what they're playing for.

---

# Distributing Winnings (Manual Process)

Until Stripe Connect is integrated, you pay out winners manually:

1. After the tournament completes, Bord shows you the final standings
2. Log into Stripe → Customers → find each winner by email
3. Use Stripe's "Send payment" or request their bank info and transfer directly
4. Or use Venmo/PayPal — whatever works for your community

A full Stripe Connect integration (where winners enter their bank details and receive automatic payouts) is on the roadmap.
