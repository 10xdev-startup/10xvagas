import { cn } from '@/lib/utils'

type TenXVagasLogoProps = {
  className?: string
}

export function TenXVagasLogo({ className }: TenXVagasLogoProps) {
  return (
    <svg
      aria-label="10xVagas"
      className={cn('shrink-0', className)}
      fill="none"
      role="img"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="rotate(-45 24 24)">
        <path
          d="M12 16a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
          fill="currentColor"
          fillRule="evenodd"
        />
        <path d="M19 21h22v6H19z" fill="currentColor" />
        <path d="M27 27h5v6h-5zM32 27h5v10h-5zM37 27h4v14h-4z" fill="currentColor" />
      </g>
    </svg>
  )
}
