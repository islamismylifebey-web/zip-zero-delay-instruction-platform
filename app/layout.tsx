import type { Metadata } from "next";
import { Geist } from "next/font/google";
import CutoverRuntime from "./cutover-runtime";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZIP — Zero Delay Instruction Platform",
  description: "Say it. ZIP it. Get it done. Turn one instruction into clear, reviewable work for field teams.",
  robots: { index: false, follow: false, noarchive: true, googleBot: { index: false, follow: false, noimageindex: true } },
  manifest: "/sad-manifest-v5.webmanifest",
  applicationName: "ZIP — Zero Delay Instruction Platform",
  appleWebApp: { capable: true, title: "ZIP", statusBarStyle: "default" },
  icons: { icon: [{ url: "/sad-royal-silver-v5-favicon.ico" }, { url: "/sad-royal-silver-v5-favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/sad-royal-silver-v5-favicon-16.png", sizes: "16x16", type: "image/png" }], shortcut: "/sad-royal-silver-v5-favicon.ico", apple: [{ url: "/sad-royal-silver-v5-apple-180.png", sizes: "180x180", type: "image/png" }] },
  openGraph: { title: "ZIP — Zero Delay Instruction Platform", description: "Say it. ZIP it. Get it done.", type: "website", images: [{ url: "/sad-royal-silver-v5-social-1200x630.png", width: 1200, height: 630, alt: "ZIP — Zero Delay Instruction Platform" }] },
  twitter: { card: "summary_large_image", title: "ZIP — Zero Delay Instruction Platform", description: "Say it. ZIP it. Get it done.", images: ["/sad-royal-silver-v5-social-1200x630.png"] },
};

export const viewport = { themeColor: "#0B5FFF", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={geist.variable}><CutoverRuntime>{children}</CutoverRuntime></body></html>;
}
