import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="block" aria-label="vadim.blog">
      <h3 className="font-bold md:text-lg sm:h4">
        <span className="text-black">vadim</span>.blog
      </h3>
    </Link>
  );
}
