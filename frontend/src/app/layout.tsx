import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Wrapper from "./components/wrapper";
import { createClient } from "@/lib/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meso-Market-Tracker",
  description: "Analytics for tracking changes in the Maple Point to Meso conversion rate in MapleStory",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  // getSession() reads the already-refreshed cookie locally (no network call) -
  // proxy.ts's middleware is the one place that actually revalidates against
  // Supabase per request. Fine here since this only decides what to render,
  // not what to authorize - every real mutation is verified independently
  // against Supabase's JWKS in the backend regardless of this value.
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Wrapper userEmail={user?.email ?? null}>{children}</Wrapper>
      </body>
    </html>
  );
}
