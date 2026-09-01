"use server";

const RECORD_PRICE_MUTATION = `
  mutation RecordPrice($price: PriceInput!) {
    recordPrice(price: $price)
  }
`;

export async function postData(formData: FormData) {
  const url = `${process.env.BACKEND_URL}/price`;

  const price = {
    datetime: formData.get("datetime") as string,
    average: parseFloat(formData.get("average") as string),
    buy100M: parseFloat(formData.get("buy100M") as string),
    buy1B: parseFloat(formData.get("buy1B") as string),
    buy10B: parseFloat(formData.get("buy10B") as string),
    sell100M: parseFloat(formData.get("sell100M") as string),
    sell1B: parseFloat(formData.get("sell1B") as string),
    sell10B: parseFloat(formData.get("sell10B") as string),
    notes: (formData.get("notes") as string) ?? "",
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: RECORD_PRICE_MUTATION, variables: { price } }),
  });

  const { data, errors } = await response.json();
  if (errors) {
    console.error("GraphQL errors:", errors);
  } else {
    console.log("Inserted id:", data.recordPrice);
  }
}