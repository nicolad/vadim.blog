"use client";

import { useState, useEffect } from "react";

import Link from "next/link";
import Logo from "./logo";
import Dropdown from "@/components/utils/dropdown";
import MobileMenu from "./mobile-menu";
import { Icons } from "../icons";

export default function Header() {
  const [top, setTop] = useState<boolean>(true);

  // detect whether user has scrolled the page down by 10px
  const scrollHandler = () => {
    window.scrollY > 10 ? setTop(false) : setTop(true);
  };

  useEffect(() => {
    scrollHandler();
    window.addEventListener("scroll", scrollHandler);
    return () => window.removeEventListener("scroll", scrollHandler);
  }, [top]);

  return (
    <header
      className={`fixed w-full z-30 md:bg-opacity-90 transition duration-300 ease-in-out ${
        !top ? "bg-[#ffffff96] backdrop-blur-sm shadow-lg" : ""
      }`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="flex items-center justify-between h-12 sm:h-14 md:h-16">
          {/* Site branding */}
          <div className=" mr-4">
            <Logo />
          </div>

          <div className="hidden md:flex gap-8">
            <Link href="/blog">Blog</Link>
            <Link href="/blog">Contact</Link>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden md:flex">
            {/* Desktop sign in links */}
            <ul className="flex grow justify-end flex-wrap items-center">
              <li>
                <a
                  href="https://cal.com/ercanmungan/30min?duration=30"
                  className="btn-sm text-gray-200 bg-gray-900 hover:bg-gray-800 ml-3 group flex items-center gap-2"
                  target="_blank"
                >
                  <span>Book a call</span>
                  <Icons.MoveRight
                    className="group-hover:translate-x-1 transition-all duration-200 ease-in-out"
                    size={16}
                  />
                </a>
              </li>
            </ul>
          </nav>

          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
