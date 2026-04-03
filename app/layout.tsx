import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fliplet Data Chat",
  description: "AI chatbot for querying Fliplet data sources",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
