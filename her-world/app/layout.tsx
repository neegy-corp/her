import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACP — Artificial Character Protocol",
  description:
    "Create an original AI character on ACP. Upload references, write the show, design separate coin artwork and prepare a pump.fun launch.",
  icons: {
    icon: "/acp-icon.svg",
    shortcut: "/acp-icon.svg",
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
