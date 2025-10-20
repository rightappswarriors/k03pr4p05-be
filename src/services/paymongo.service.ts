import axios from "axios";
import { decrypt } from "../lib/encrypt";

const API_BASE = "https://api.paymongo.com/v1";
const return_url =
  "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjdncms5YnBld3JqbDZybHRvYjFzbTl4Nm5obWo0ODNpeXo1eG92bCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/A5F11Cbo7b8cw/giphy.gif";

/*
 * Create a Payment Method
 */
export async function createPaymentMethod(billing: any) {
  console.log("Create payment method Billing:", billing)
  try {
    let attributes: any = {
      type: billing.paymentType,
    }

    if (billing.paymentType === "card"){
        attributes.details = {
          card_number: decrypt(billing.customerDetails.card_number),
          cvc: decrypt(billing.customerDetails.cvc),
          exp_month: billing.customerDetails.exp_month,
          exp_year: billing.customerDetails.exp_year,
          bank_code: billing.customerDetails.bank_code,
        }
    } else if (billing.paymentType === "gcash" || billing.paymentType === "paymaya") {
      attributes.billing = {
        name: billing.customerDetails?.fullname ?? "N/A",
        email: billing.customerDetails?.email ?? "unknown@example.com",
        phone: billing.customerDetails?.phoneNumber ?? "0000000000",
      }
    }
    console.log("Attributes:", attributes)
    const base64key = Buffer.from(`${billing.secret_key}:`).toString("base64");
    const response = await axios.post(
      `${API_BASE}/payment_methods`,
      {
        data: {
          attributes
        },
      },
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Basic ${base64key}`,
        },
      }
    );
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
  const base64key = Buffer.from(`${secret_key}:`).toString("base64");

  try {
    const response = await axios.post(
      `${API_BASE}/payment_intents`,
      {
        data: {
          attributes: {
            amount: Math.round(amount * 100),
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
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Basic ${base64key}`,
        },
      }
    );
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
  const base64key = Buffer.from(`${secret_key}:`).toString("base64");
  try {
    const response = await axios.post(
      `${API_BASE}/payment_intents/${paymentIntentId}/attach`,
      {
        data: {
          attributes: {
            payment_method: paymentMethodId,
            client_key: clientKey,
            return_url: return_url,
          },
        },
      },
      {
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Basic ${base64key}`,
        },
      }
    );
    return { data: response.data };
  } catch (error) {
    console.error("Error attaching payment intent:", error);
    throw new Error("Error attaching payment intent.");
  }
}
