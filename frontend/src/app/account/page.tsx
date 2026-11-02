import { fetchMe } from "../accountActions";

export default async function AccountPage() {
  const me = await fetchMe();

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900">Account</h2>
      {me ? (
        <p className="mt-2 text-gray-600">Logged in as {me.email}</p>
      ) : (
        <p className="mt-2 text-gray-600">You&apos;re not logged in.</p>
      )}
    </div>
  );
}
