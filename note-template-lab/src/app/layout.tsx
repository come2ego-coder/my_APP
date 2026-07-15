import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "売れるnoteの型 分析ラボ",
  description:
    "ジャンルを入力するとAIが切り口を提案し、実際に読まれているnote記事の「型」を分析。その型を使って新しい記事の下書きを自動生成します。",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen font-gothic text-sumi antialiased">
        {children}
      </body>
    </html>
  );
}
