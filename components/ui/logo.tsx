import Image from "next/image";
import Link from "next/link";

export default function Logo() {
  return (
    <Link href="/" className="block" aria-label="Poshet">
      {/* <Image
        src="/images/poshet-black-transparent.png"
        alt="Poshet logo"
        width={60}
        height={50}
      ></Image> */}
      <h3 className="font-bold md:text-lg sm:h4">
        <span className="text-black">p</span>oshet
      </h3>
    </Link>
  );
}
