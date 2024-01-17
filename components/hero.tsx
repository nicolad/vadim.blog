import { Icons } from "./icons";
import Badge from "./ui/badge";

export default function Hero() {
  return (
    <section className="relative">
      {/* Illustration behind hero content */}
      <div
        className="absolute left-1/2 transform -translate-x-1/2 bottom-0 pointer-events-none -z-1"
        aria-hidden="true"
      >
        <svg
          width="1360"
          height="578"
          viewBox="0 0 1360 578"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              x1="50%"
              y1="0%"
              x2="50%"
              y2="100%"
              id="illustration-01"
            >
              <stop stopColor="#FFF" offset="0%" />
              <stop stopColor="#EAEAEA" offset="77.402%" />
              <stop stopColor="#DFDFDF" offset="100%" />
            </linearGradient>
          </defs>
          <g fill="url(#illustration-01)" fillRule="evenodd">
            <circle cx="1232" cy="128" r="128" />
            <circle cx="155" cy="443" r="64" />
          </g>
        </svg>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col justify-center  h-full">
        {/* Hero content */}
        <div className="h-[calc(100vh)] flex flex-col justify-center">
          {/* Section header */}
          <div className="text-left pb-12 md:pb-16 max-w-[642px]">
            <Badge cn="mb-4" dataAos="fade-down" dataAosDelay="450">
              Based in Turkiye, available worldwide
            </Badge>
            <h1
              className="h1 font-extrabold leading-tighter tracking-tighter mb-4"
              data-aos="fade-up"
            >
              Websites that convert{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-400">
                {" "}
                visitors{" "}
              </span>
              into
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-400">
                {" "}
                customers.
              </span>
            </h1>
            <div className="max-w-3xl">
              <p
                className="sm:text-xl text-gray-600 mb-8 "
                data-aos="fade-up"
                data-aos-delay="150"
              >
                Expertly designed and developed websites that communicate your
                business's value proposition, driving success
              </p>
              <div className="max-w-xs" data-aos="fade-up" data-aos-delay="300">
                <div className="group">
                  <a
                    className="btn font-semibold text-white bg-blue-800 hover:bg-blue-700 w-auto sm:w-auto flex items-center gap-2"
                    href="https://cal.com/ercanmungan/30min?duration=30"
                    target="_blank"
                  >
                    Book a call
                    <Icons.MoveRight
                      className="group-hover:translate-x-1 transition-all duration-200 ease-in-out"
                      size={16}
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col w-full h-px items-center justify-center mt-12">
          <div className="w-full h-px opacity-50 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full mt-4"></div>
        </div>
      </div>
    </section>
  );
}
