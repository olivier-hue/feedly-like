import "./globals.css";
import type { ReactNode } from "react";
import { PwaRegister } from "./pwa-register";

export const metadata = {
  title: "Sports & Esports Business Curator",
  description: "Local content curation tool for sports & esports business."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#020617" />
      </head>
      <body className="min-h-screen">
        <PwaRegister />
        <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}

