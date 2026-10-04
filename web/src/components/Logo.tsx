type Props = {
  className?: string
  color?: string
}

export function Logo({ className = 'h-7 w-[132px]', color = '#0F766E' }: Props) {
  return (
    <span
      role="img"
      aria-label="Aval"
      className={`inline-block ${className}`}
      style={{
        backgroundColor: color,
        WebkitMaskImage: 'url(/aval-logo.png)',
        maskImage: 'url(/aval-logo.png)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskPosition: 'left center',
        maskPosition: 'left center',
      }}
    />
  )
}
