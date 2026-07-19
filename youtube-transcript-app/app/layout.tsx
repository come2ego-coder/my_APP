import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube文字起こしツール",
  description: "YouTube動画のURLから字幕を取得して文字起こしするツール",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
