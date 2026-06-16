import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'cyan' | 'gold' | 'green' | 'red' | 'gray' | 'blue'
  size?: 'sm' | 'md'
}

export default function Badge({ className, variant = 'cyan', size = 'sm', children, ...props }: BadgeProps) {
  const variants = {
    cyan: 'bg-cyan-glow/10 text-cyan-glow border-cyan-glow/30',
    gold: 'bg-gold/10 text-gold border-gold/30',
    green: 'bg-neon-green/10 text-neon-green border-neon-green/30',
    red: 'bg-neon-red/10 text-neon-red border-neon-red/30',
    gray: 'bg-[#8888aa]/10 text-[#8888aa] border-[#8888aa]/30',
    blue: 'bg-electric-blue/10 text-electric-blue border-electric-blue/30',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
