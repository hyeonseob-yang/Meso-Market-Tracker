"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { text: "Chart", href: "/" },
  { text: "Predictions", href: "/predictions" },
];

export default function NavDrawer({
  isOpen,
  onClose,
  userEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <nav
        className={`fixed left-0 top-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col z-30 transition-transform md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 border-b border-gray-200" />
        <ul className="py-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.text}>
              <Link
                href={item.href}
                onClick={onClose}
                className={`flex items-center px-4 py-2 transition-colors ${
                  pathname === item.href
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.text}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto border-t border-gray-200 p-4">
          {userEmail ? (
            <>
              <p className="truncate text-sm text-gray-600">{userEmail}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 text-sm font-medium text-blue-700 hover:underline"
              >
                Log out
              </button>
            </>
          ) : (
            <Link href="/login" onClick={onClose} className="text-sm font-medium text-blue-700 hover:underline">
              Log in
            </Link>
          )}
        </div>
      </nav>
    </>
  );
}
