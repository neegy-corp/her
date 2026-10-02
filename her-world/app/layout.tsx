import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HER — A new face for the trenches",
  description: "Meet HER's first three AI characters. Explore Pro faces and the upcoming token-burn stage on pump.fun.",
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
