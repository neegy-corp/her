import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HER — Your AI host",
  description: "A presence. Not just a reply. HER brings a female AI personality to your pump.fun chat and camera.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
