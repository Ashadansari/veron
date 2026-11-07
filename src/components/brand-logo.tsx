import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  label?: string;
  variant?: "light" | "on-dark";
  compact?: boolean;
  className?: string;
  onClick?: () => void;
};

export function BrandLogo({
  href = "/",
  label = "VÉRON home",
  variant = "light",
  compact = false,
  className = "",
  onClick,
}: BrandLogoProps) {
  const source = compact ? "/veron-monogram.svg" : variant === "on-dark" ? "/veron-logo-light.svg" : "/veron-logo.svg";
  return (
    <Link className={`brand-logo-link ${className}`.trim()} href={href} aria-label={label} onClick={onClick}>
      <Image
        className={compact ? "brand-logo brand-logo-compact" : "brand-logo"}
        src={source}
        alt=""
        width={compact ? 120 : 460}
        height={compact ? 120 : 100}
        priority
        unoptimized
      />
    </Link>
  );
}
