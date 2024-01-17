import React from "react";
import Badge from "./ui/badge";
import Image from "next/image";

const Services = () => {
  return (
    <>
      <section
        className="text-center max-w-[642px] mx-auto px-4 sm:px-6 "
        data-aos="fade-up"
      >
        <div className="my-8">
          <Badge>Our services</Badge>
        </div>
        <h1 className="h2">
          We craft{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-t bg-black">
            digital experiences
          </span>
        </h1>
        <div className="flex flex-col">
          <p className="mt-4 sm:mt-6 text-lg">
            In a world of generic enterprise software, we use our proven process
            to uncover your business needs, craft a tailored software solution,
            and transform your company into a digital leader.
          </p>
          <p className="mt-4 sm:mt-6 text-lg">
            Our team of expert designers, developers and copywriters will guide
            you through every step of the process to ensure that your website
            not only looks great, but delivers results.
          </p>
        </div>
      </section>
      <section
        className="text-center max-w-[842px] mx-auto px-4 sm:px-6 relative"
        data-aos="fade-up"
        data-aos-delay="200"
      >
        {/* Words section */}
        <Image
          src="/images/light-blue.png"
          alt="light"
          width={800}
          height={800}
          className="absolute opacity-30 top-0 sm:-top-32"
        ></Image>
        <div className="mt-12 h-[412px] relative font-semibold">
          <div className="text-2xl sm:text-4xl bg-clip-text text-transparent bg-gradient-to-t from-blue-700 to-teal-400 absolute left-12">
            SEO-first
          </div>
          <div className="text-2xl sm:text-4xl bg-clip-text text-transparent bg-gradient-to-t from-blue-700 to-teal-400 absolute right-0 top-4">
            e-commerce
          </div>
          <div className="text-2xl sm:text-4xl bg-clip-text text-transparent bg-gradient-to-t from-blue-700 to-teal-400 absolute top-16 right-4 sm:right-72">
            web apps
          </div>
          <div className="text-2xl sm:text-4xl bg-clip-text text-transparent bg-gradient-to-t from-blue-700 to-teal-400 absolute top-[78px]">
            landing pages
          </div>
          <div className="text-2xl sm:text-4xl bg-clip-text text-transparent bg-gradient-to-t from-blue-700 to-teal-400 absolute top-36 right-6 sm:right-24">
            CRO-optimised
          </div>
          <div className="text-2xl sm:text-4xl bg-clip-text text-transparent bg-gradient-to-t from-blue-700 to-teal-400 absolute  right-2 top-[244px]">
            API integrations
          </div>
          <div className="text-2xl sm:text-4xl bg-clip-text text-transparent bg-gradient-to-t from-blue-700 to-teal-400 absolute top-[196px] -left-1">
            mobile apps
          </div>
        </div>
      </section>
    </>
  );
};

export default Services;
