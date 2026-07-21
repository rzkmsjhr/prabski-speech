import type { Metadata } from "next";
import { Libre_Franklin, Lora } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const sans = Libre_Franklin({ variable: "--font-sans", subsets: ["latin"] });
const serif = Lora({ variable: "--font-serif", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Prabowo Speech Watch";
  const description = "Pantau jadwal pidato Presiden Prabowo berikutnya, lokasi, hitung mundur, dan pergerakan USD/IDR.";
  const image = `${origin}/og.png`;
  return {
    metadataBase: new URL(origin),
    title,
    description,
    openGraph: { title, description, type: "website", url: origin, images: [{ url: image, width: 1733, height: 907, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body className={`${sans.variable} ${serif.variable}`}>{children}</body></html>;
}
