import Link from "next/link";

const NAV_ITEMS = [{ text: "Chart", href: "/" }];

export default function NavDrawer() {
  return (
    <nav className="fixed left-0 top-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col">
      <div className="h-16 border-b border-gray-200" />
      <ul className="py-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.text}>
            <Link
              href={item.href}
              className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {item.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
