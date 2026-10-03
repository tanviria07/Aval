type Props = {
  text: string
}

export function CaptionBar({ text }: Props) {
  return (
    <div className="flex h-20 w-full items-center justify-center bg-ink px-8 text-center text-2xl text-white">
      {text}
    </div>
  )
}
