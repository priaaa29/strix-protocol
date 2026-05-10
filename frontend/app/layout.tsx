import type { Metadata } from 'next';
import { Space_Grotesk, Bodoni_Moda, Work_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Layout } from '@/components/Layout';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-syne',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

// Didone serif italic — same classification as Ranemia Pro. Extreme hairline
// vs thick strokes, optical-size axis makes it spectacular at display scale.
const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Strix Protocol — Options on Stellar',
  description:
    'The first decentralized options protocol on Stellar. Trade XLM options, earn yield by providing liquidity.',
  keywords: ['Stellar', 'DeFi', 'Options', 'XLM', 'Soroban'],
  openGraph: {
    title: 'Strix Protocol',
    description: 'First Options Protocol on Stellar',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${bodoniModa.variable} ${workSans.variable} ${ibmPlexMono.variable}`}>
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
