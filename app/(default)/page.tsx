export const metadata = {
  title: "Poshet Digital | Crafted Websites & Digital Solutions",
  description:
    "Transform your business with expertly designed websites and tailored software solutions. Book a consultation for SEO-focused services at Poshet.co.",
};

import Hero from "@/components/hero";
import Services from "@/components/services";
import Newsletter from "@/components/newsletter";

export default function Home() {
  return (
    <>
      <Hero />
      <Services />
      <Newsletter />
    </>
  );
}
