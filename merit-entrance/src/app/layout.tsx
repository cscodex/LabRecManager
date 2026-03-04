import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import SessionWrapper from '@/components/SessionWrapper';
import { MathJaxProvider } from '@/components/providers/MathJaxProvider';
import { neon } from '@neondatabase/serverless';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
  let siteName = 'Merit Entrance';
  try {
    const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');
    const rows = await sql`SELECT value FROM system_settings WHERE key = 'siteName'`;
    if (rows.length > 0) {
      siteName = rows[0].value.replace(/^"|"$/g, '');
    }
  } catch (err) {
    console.error('Failed to load siteName for metadata', err);
  }

  return {
    title: `${siteName} - Online Exam Platform`,
    description: `${siteName} Entrance Exam Preparation`,
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: siteName,
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: [
        { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [
        { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      ],
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e3a8a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-152x152.png" />
      </head>

      <body className={inter.className}>
        <SessionWrapper>
          <MathJaxProvider>
            {children}
          </MathJaxProvider>
        </SessionWrapper>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
            },
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                      console.log('ServiceWorker registered:', reg.scope);
                    })
                    .catch(function(err) {
                      console.log('ServiceWorker registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
