import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'Lab Record Manager | प्रयोगशाला रिकॉर्ड प्रबंधक',
    description: 'Comprehensive lab management system for Indian schools with multi-language support',
    keywords: 'lab, school, assignments, grading, viva, India, education',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={inter.className}>
                <Providers>
                    {children}
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            duration: 4000,
                            style: {
                                borderRadius: '12px',
                                padding: '16px',
                            },
                        }}
                    />
                </Providers>
            </body>
        </html>
    );
}
