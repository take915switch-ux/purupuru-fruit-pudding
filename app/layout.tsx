import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ぷるぷるフルーツプリン",
  description: "うごくフルーツをタップして、プリンにもりつける5さいからのゲーム",
  icons: { icon: "/assets/pudding.png" },
  openGraph: {
    title: "ぷるぷるフルーツプリン",
    description: "タップして、もりつけて、じぶんだけのプリンをつくろう！",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
