import type Stripe from "stripe";
import { stripeRequest } from "./stripeClient";

type StripeList<T> = { data: T[] };

async function seedProfessionalPlan() {
  const query = encodeURIComponent(
    "metadata['app_plan']:'professional' AND active:'true'",
  );
  const products = await stripeRequest<StripeList<Stripe.Product>>(
    `/v1/products/search?query=${query}&limit=1`,
  );
  const product =
    products.data[0] ??
    (await stripeRequest<Stripe.Product>(
      "/v1/products",
      new URLSearchParams({
        name: "Profesjonalista",
        description: "Nielimitowany dostęp do danych kontaktowych klientów.",
        "metadata[app_plan]": "professional",
      }),
    ));

  const prices = await stripeRequest<StripeList<Stripe.Price>>(
    `/v1/prices?product=${encodeURIComponent(product.id)}&active=true&type=recurring&limit=100`,
  );
  const price =
    prices.data.find(
      (candidate) =>
        candidate.unit_amount === 9900 &&
        candidate.currency === "pln" &&
        candidate.recurring?.interval === "month",
    ) ??
    (await stripeRequest<Stripe.Price>(
      "/v1/prices",
      new URLSearchParams({
        product: product.id,
        unit_amount: "9900",
        currency: "pln",
        "recurring[interval]": "month",
        nickname: "Profesjonalista",
        "metadata[app_plan]": "professional",
      }),
    ));

  console.log(`Plan gotowy: ${product.id}, ${price.id}`);
}

seedProfessionalPlan().catch((error) => {
  console.error("Nie udało się przygotować planu Stripe:", error);
  process.exitCode = 1;
});