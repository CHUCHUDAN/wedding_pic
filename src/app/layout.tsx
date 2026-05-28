import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '我們的婚紗 · Our Wedding',
  description: '紀錄此生最重要的時刻',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
