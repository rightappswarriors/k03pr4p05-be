import axios from "axios";

const API_BASE = "https://api.paymongo.com/v1";
const return_url =
  "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjdncms5YnBld3JqbDZybHRvYjFzbTl4Nm5obWo0ODNpeXo1eG92bCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/A5F11Cbo7b8cw/giphy.gif";

/*
 * Create a Payment Method
 */
export async function createPaymentMethod(billing) {
  try {
    const base64key = Buffer.from(`${billing.secret_key}`).toString();
    const response = await axios.post(`${API_BASE}/payment_methods`, {
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
        authorization: `Basic ${base64key}`,
      },
      data: {
        data: {
          attributes: {
            type: billing.paymentType, // or card, paymaya, etc.
            billing,
          },
        },
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error creating Payment Method:", error);
    throw new Error("Error creating Payment method.");
  }
}

/**
 * Create a Payment Intent
 */
export async function createPaymentIntent(amount, description, secret_key) {
  const base64key = Buffer.from(`${secret_key}`).toString();
  try {
    const response = await axios.post(`${API_BASE}/payment_intents`, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Basic ${base64key}`,
      },
      data: {
        data: {
          attributes: {
            amount,
            currency: "PHP",
            payment_method_allowed: ["gcash", "card", "paymaya"],
            payment_method_options: {
              card: { request_three_d_secure: "automatic" },
            },
            capture_type: "automatic",
            description,
          },
        },
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error creating Payment Intent", error);
    throw new Error("Error creating payment Intent");
  }
}

/**
 * Attach Payment Method to Payment Intent
 */
export async function attachPaymentIntent(
  paymentIntentId,
  paymentMethodId,
  clientKey,
  secret_key
) {
  const base64key = Buffer.from(`${secret_key}`).toString();
  try {
    const response = await axios.post(
      `${API_BASE}/payment_intents/${paymentIntentId}/attach`,
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Basic ${base64key}`,
        },
        data: {
          data: {
            attributes: {
              payment_method: paymentMethodId,
              client_key: clientKey,
              return_url: return_url,
            },
          },
        },
      }
    );
    return { data: response.data};
  } catch (error) {
    console.error("Error attaching payment intent:", error);
    throw new Error("Error attaching payment intent.");
  }
}
