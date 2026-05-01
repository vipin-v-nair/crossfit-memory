import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrossFit Memory",
  description: "CrossFit Coach powered by Vertex AI Memory Bank",
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
