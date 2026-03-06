"use server";

export async function postData(formData: FormData) {
  const date = formData.get("date");
  const avg = formData.get("avg");

  const buy100m = formData.get("buy-100m");
  const buy1b = formData.get("buy-1b");
  const buy10b = formData.get("buy-10b");

  const sell100m = formData.get("sell-100m");
  const sell1b = formData.get("sell-1b");
  const sell10b = formData.get("sell-10b");

  const notes = formData.get("notes");

  const body = {
    date,
    avg,
    buy100m,
    buy1b,
    buy10b,
    sell100m,
    sell1b,
    sell10b,
    notes,
  };
  console.log(JSON.stringify(body));
}
