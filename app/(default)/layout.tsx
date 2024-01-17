"use client";

import { useEffect } from "react";
import AOS from "aos";
import "aos/dist/aos.css";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    AOS.init({
      once: true,
      // disable: 'phone',
      duration: 700,
      easing: "ease-out-cubic",
    });
  });

  return (
    <>
      <div className="mt-16 sm:mt-24"></div>
      <main className="grow min-h-[100vh] w-full max-w-6xl px-5 sm:px-6">
        {children}
      </main>
    </>
  );
}
