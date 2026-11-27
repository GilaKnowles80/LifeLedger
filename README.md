# LifeLedger

Connect with your circles, support local makers, and share everyday moments in good company. LifeLedger brings neighbors, communities, and small creators together in a calmer, more intentional online space.

## LifeLedger and PayPal

Run locally with `npm install` and `npm run dev`. PayPal credentials belong in the ignored `.env.local`; never commit the client secret or expose it with a `NEXT_PUBLIC_` variable.

The configured website is `https://www.lifeledger.live`. Set the PayPal webhook URL to `https://www.lifeledger.live/api/paypal/webhook` and subscribe to all events. The root URL is not the webhook endpoint. The app verifies webhook signatures, creates a PHP 250 order, verifies and captures approved payments, and places paid ads into review rather than publishing automatically.

Ad records are stored under `.data/ads`. Replace this local file store with a managed database before running multiple production instances.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev



