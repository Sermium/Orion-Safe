import { Router } from "express";

const router = Router();

/* =========================================================================
 *  Environment variables (set these on your server, never in code):
 *
 *    TRANSAK_API_KEY        - public API key
 *    TRANSAK_API_SECRET     - secret (used to mint access-token)
 *    TRANSAK_ENV            - "STAGING" | "PRODUCTION"  (default STAGING)
 *    TRANSAK_REFERRER_DOMAIN- your approved domain, e.g. "orion-safe.vercel.app"
 *
 *    STRIPE_SECRET_KEY      - sk_test_... or sk_live_...  (onramp must be approved)
 * ========================================================================= */

const TRANSAK_ENV = (process.env.TRANSAK_ENV || "STAGING").toUpperCase();

// NOTE: the refresh-token API and the session API live on DIFFERENT hosts.
//   refresh-token -> api(-stg).transak.com         (/partners/api/v2/refresh-token)
//   create session -> api-gateway(-stg).transak.com (/api/v2/auth/session)
const TRANSAK_HOSTS =
  TRANSAK_ENV === "PRODUCTION"
    ? {
        auth: "https://api.transak.com",
        gateway: "https://api-gateway.transak.com",
      }
    : {
        auth: "https://api-stg.transak.com",
        gateway: "https://api-gateway-stg.transak.com",
      };

/* -------------------------------------------------------------------------
 *  TRANSAK
 *  Flow: refresh access-token with apiKey+secret, then create a signed
 *  one-time widgetUrl that the frontend SDK loads. Token is valid 7 days
 *  (we mint a fresh one per request here for simplicity; cache if needed).
 * ----------------------------------------------------------------------- */

async function getTransakAccessToken() {
  const apiKey = process.env.TRANSAK_API_KEY;
  const apiSecret = process.env.TRANSAK_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error("Transak not configured (TRANSAK_API_KEY / TRANSAK_API_SECRET)");
  }

  const resp = await fetch(`${TRANSAK_HOSTS.auth}/partners/api/v2/refresh-token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-secret": apiSecret,
    },
    body: JSON.stringify({ apiKey }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Transak token error ${resp.status}: ${text}`);
  }
  const json = await resp.json();
  // Response shape: { data: { accessToken, expiresAt } }
  const token = json?.data?.accessToken;
  if (!token) throw new Error("Transak token missing in response");
  return token;
}

// POST /onramp/transak/session
// body: { walletAddress, cryptoCurrencyCode?, network?, fiatCurrency?, amount? }
router.post("/onramp/transak/session", async (req, res) => {
  try {
    const apiKey = process.env.TRANSAK_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "Transak not configured" });
    }

    const referrerDomain = process.env.TRANSAK_REFERRER_DOMAIN;
    if (!referrerDomain) {
      return res
        .status(503)
        .json({ error: "Transak not configured (TRANSAK_REFERRER_DOMAIN required)" });
    }

    const {
      walletAddress,
      cryptoCurrencyCode = "USDC",
      network = "stellar",
      fiatCurrency,
      amount,
    } = req.body || {};

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress required" });
    }

    const accessToken = await getTransakAccessToken();

    // Build the widget params. apiKey + referrerDomain are MANDATORY.
    const widgetParams = {
      apiKey,
      referrerDomain,
      productsAvailed: "BUY",
      cryptoCurrencyCode,
      network,
      walletAddress,
      disableWalletAddressForm: true, // lock destination to the vault
      themeColor: "06b6d4",
      ...(fiatCurrency ? { fiatCurrency } : {}),
      ...(amount ? { fiatAmount: Number(amount) } : {}),
    };

    const resp = await fetch(`${TRANSAK_HOSTS.gateway}/api/v2/auth/session`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "access-token": accessToken,
      },
      body: JSON.stringify({ widgetParams }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Transak session error ${resp.status}: ${text}`);
    }

    const json = await resp.json();
    // Response shape: { data: { widgetUrl } }
    const widgetUrl = json?.data?.widgetUrl;
    if (!widgetUrl) throw new Error("Transak widgetUrl missing in response");

    res.json({ widgetUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -------------------------------------------------------------------------
 *  STRIPE  (parked — activates automatically when STRIPE_SECRET_KEY is set
 *  and your onramp application is approved)
 *  Flow: create an OnrampSession, return client_secret to the frontend.
 * ----------------------------------------------------------------------- */

// POST /onramp/stripe/session
// body: { walletAddress, destinationCurrency?, destinationNetwork?, amount? }
router.post("/onramp/stripe/session", async (req, res) => {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return res.status(503).json({ error: "Stripe onramp not configured" });
    }

    const {
      walletAddress,
      destinationCurrency = "usdc",
      destinationNetwork = "stellar",
      amount,
    } = req.body || {};

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress required" });
    }

    // Stripe's onramp endpoint is not in the main SDK surface; call the REST
    // API directly with form-encoding to avoid an extra dependency.
    const form = new URLSearchParams();
    form.set("wallet_addresses[stellar]", walletAddress);
    form.set("destination_currencies[]", destinationCurrency);
    form.set("destination_networks[]", destinationNetwork);
    form.set("destination_currency", destinationCurrency);
    form.set("destination_network", destinationNetwork);
    if (amount) form.set("destination_amount", String(amount));

    const resp = await fetch("https://api.stripe.com/v1/crypto/onramp_sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Stripe session error ${resp.status}: ${text}`);
    }

    const json = await resp.json();
    res.json({ clientSecret: json.client_secret, id: json.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /onramp/status -> which providers the backend can serve
router.get("/onramp/status", (_req, res) => {
  res.json({
    transak:
      !!process.env.TRANSAK_API_KEY &&
      !!process.env.TRANSAK_API_SECRET &&
      !!process.env.TRANSAK_REFERRER_DOMAIN,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    transakEnv: TRANSAK_ENV,
  });
});

export default router;
