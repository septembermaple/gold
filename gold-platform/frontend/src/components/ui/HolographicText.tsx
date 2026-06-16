import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface HolographicTextProps extends HTMLAttributes<HTMLSpanElement> {
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'p'
  color?: 'cyan' | 'gold' | 'mixed' | 'blue' | 'green' | 'red'
}

export default function HolographicText({
  as: Component = 'span',
  color = 'cyan',
  className,
  children,
  ...props
}: HolographicTextProps) {
  const colors = {
    cyan: 'from-cyan-glow via-electric-blue to-cyan-glow',
    gold: 'from-gold via-gold-dark to-gold',
    mixed: 'from-cyan-glow via-gold to-cyan-glow',
    blue: 'from-electric-blue via-cyan-glow to-electric-blue',
    green: 'from-neon-green via-cyan-glow to-neon-green',
    red: 'from-neon-red via-gold-dark to-neon-red',
  }

  return (
    <Component
      className={cn(
        'inline-block bg-clip-text text-transparent bg-[length:200%_auto]',
        'animate-holographic',
        `bg-gradient-to-r ${colors[color]}`,
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}
