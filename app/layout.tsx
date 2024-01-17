import "./css/style.css";

import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";
import Script from "next/script";
import Analytics from "./GoogleAnalytics";
import { Suspense } from "react";

export const metadata = {
  metadataBase: new URL("https://poshet.co"),
  alternates: {
    canonical: "/",
    // languages: {
    //   'en-US': '/en-US',
    //   'de-DE': '/de-DE',
    // },
  },
  openGraph: {
    images: "/images/poshet-black-transparent.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <Suspense>
        <Analytics />
      </Suspense>
      <body className={`antialiased bg-white text-gray-900 tracking-tight`}>
        <div className="flex items-center flex-col min-h-screen overflow-hidden supports-[overflow:clip]:overflow-clip">
          <Header />
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
