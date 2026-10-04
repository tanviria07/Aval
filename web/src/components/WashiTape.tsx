type Props = {
  pattern?: 'rose' | 'gingham'
  className?: string
}

export function WashiTape({ pattern = 'rose', className = '' }: Props) {
  const style =
    pattern === 'gingham'
      ? {
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(166,61,64,.75) 0 7px, rgba(244,236,221,.65) 7px 14px)',
        }
      : { backgroundColor: 'rgba(201,123,132,.72)' }
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-10 h-5 w-24 rotate-[4deg] ${className}`}
      style={style}
    />
  )
}
