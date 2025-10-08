import axios from "axios";

const API_BASE = "https://api.paymongo.com/v1";
const SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;

/**
 * Create a Payment Method
 */
export async function createPaymentMethod(billing) {
     const base64key = Buffer.from(`${billing.secret_key}`).toString()
     const response = await axios.post(
    `${API_BASE}/payment_methods`,
    {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        authorization: `Basic ${base64key}`,
      },
      data: {
        attributes: {
          type: billing.paymentType, // or card, paymaya, etc.
          billing,
        },
      },
    },

    {
      auth: { username: SECRET_KEY, password: "" },
    }
  );
  return response.data;
}

/**
 * Create a Payment Intent
 */
export async function createPaymentIntent(amount, description) {
  const response = await axios.post(
    `${API_BASE}/payment_intents`,
    {
      data: {
        attributes: {
          amount,
          currency: "PHP",
          payment_method_allowed: ["gcash", "card"],
          capture_type: "automatic",
          description,
        },
      },
    },
    {
      auth: { username: SECRET_KEY, password: "" },
    }
  );
  return response.data;
}

/**
 * Attach Payment Method to Payment Intent
 */
export async function attachPaymentIntent(
  paymentIntentId,
  paymentMethodId,
  clientKey
) {
  const response = await axios.post(
    `${API_BASE}/payment_intents/${paymentIntentId}/attach`,
    {
      data: {
        attributes: {
          payment_method: paymentMethodId,
          client_key: clientKey,
          return_url: "https://yourapp.com/success",
        },
      },
    },
    {
      auth: { username: SECRET_KEY, password: "" },
    }
  );
  return response.data;
}
