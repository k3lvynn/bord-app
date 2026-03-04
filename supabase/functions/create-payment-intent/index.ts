// supabase/functions/create-payment-intent/index.ts
// Deploy: supabase functions deploy create-payment-intent
//
// Set these secrets ONCE in your Supabase project:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

// @ts-ignore
// Deploy with JWT verification disabled:
//   supabase functions deploy create-payment-intent --no-verify-jwt
//
// This allows the anon key to be used as the bearer token, which is
// correct for a payment endpoint called from the mobile app.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Guard: fail fast with a clear message if secret not configured
    if (!STRIPE_KEY || STRIPE_KEY.length < 20) {
      return new Response(
        JSON.stringify({ error: 'STRIPE_SECRET_KEY is not configured on this server. Run: supabase secrets set STRIPE_SECRET_KEY=sk_test_...' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const { eventId, eventTitle, amountCents, customerEmail, customerName } = await req.json();

    if (!amountCents || amountCents < 100) {
      throw new Error('Amount must be at least $1.00');
    }

    // Create or retrieve Stripe customer
    let customerId: string | undefined;
    if (customerEmail) {
      const existing = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email: customerEmail,
          name:  customerName,
          metadata: { source: 'bord_app' },
        });
        customerId = customer.id;
      }
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   amountCents,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata: {
        event_id:    eventId,
        event_title: eventTitle,
        source:      'bord_app',
      },
      description: `Bord event buy-in: ${eventTitle}`,
    });

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, customerId }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err: any) {
    console.error('create-payment-intent error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});
