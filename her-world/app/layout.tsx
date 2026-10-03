import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HER — The character launchpad",
  description: "Create an original AI character. Design its appearance, personality, voice and world, then prepare its pump.fun launch with HER.",
  icons: {
    icon: "/olivia-icon.png",
    shortcut: "/olivia-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
