import React from "react";
import cn from "classnames";

type BadgeProps = {
  children?: React.ReactNode;
  dataAos?: string;
  dataAosDelay?: string;
  cn?: string;
};

const Badge = (props: BadgeProps) => {
  return (
    <div
      data-aos-delay={props.dataAosDelay}
      data-aos={props.dataAos}
      className={cn(
        "inline-flex w-auto items-center px-2.5 py-0.5 rounded-full text-sm font-medium border border-gray-200 text-gray-600 hover:text-gray-700 hover:bg-gray-100 transition-all",
        props.cn
      )}
    >
      {props.children}
    </div>
  );
};

export default Badge;
