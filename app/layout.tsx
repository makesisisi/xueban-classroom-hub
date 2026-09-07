import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '学伴 · 学委服务站',
  description: '作业不漏交，信息不掉队。属于我们班的学习服务站。',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
