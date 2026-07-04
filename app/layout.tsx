import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Company Research Assistant',
  description: 'Research any company with AI — crawling, competitor analysis, and PDF reports.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
