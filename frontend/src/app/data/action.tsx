"use server";

export async function postData(formData: FormData) {
  console.log(formData);

  const url = `${process.env.BACKEND_URL}/price`;

  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    body: formData,
  });

  const text = await response.text();
  console.log(text)
}