"use client";

import { useState } from "react";

import NavDrawer from "./navDrawer";

export default function Wrapper({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100">
      <NavDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      <div className="flex flex-col flex-1 md:ml-60">
        <header className="fixed top-0 left-0 right-0 md:left-60 h-16 bg-blue-700 flex items-center px-6 z-10 shadow">
          <button
            type="button"
            onClick={() => setIsDrawerOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="mr-4 text-white md:hidden"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-white text-lg font-medium tracking-wide">
            Meso Tracker
          </h1>
        </header>
        <main className="mt-16 p-6 flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
