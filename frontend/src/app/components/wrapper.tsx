import NavDrawer from "./navDrawer";

export default function Wrapper({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen bg-gray-100">
      <NavDrawer />
      <div className="flex flex-col flex-1 ml-60">
        <header className="fixed top-0 left-60 right-0 h-16 bg-blue-700 flex items-center px-6 z-10 shadow">
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
