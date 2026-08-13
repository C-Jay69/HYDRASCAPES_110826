import Image from 'next/image';

export function Logo({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Hydrascapes"
      width={1664}
      height={928}
      className={className}
      priority
    />
  );
}

export default Logo;
