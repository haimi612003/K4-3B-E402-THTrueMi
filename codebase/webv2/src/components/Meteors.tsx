import type { CSSProperties } from 'react'

// Adapted from Magic UI: https://magicui.design/docs/components/meteors
export function Meteors({ number = 18 }: { number?: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden motion-reduce:hidden">
      {Array.from({ length: number }, (_, index) => (
        <span
          key={index}
          className="hero-meteor absolute -top-2 size-0.5 rounded-full bg-neutral-300"
          style={{
            '--meteor-angle': '215deg',
            left: `${(index * 61.8) % 140}%`,
            animationDelay: `${-index * 1.7}s`,
            animationDuration: `${6 + (index % 5)}s`,
          } as CSSProperties}
        >
          <span className="absolute top-1/2 h-px w-20 -translate-y-1/2 bg-linear-to-r from-neutral-400/60 to-transparent" />
        </span>
      ))}
    </div>
  )
}
