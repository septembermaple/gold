import { type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface GlowCardProps extends HTMLAttributes<HTMLDivElement> {
  color?: 'cyan' | 'gold' | 'blue' | 'green' | 'red'
  hover?: boolean
}

export default function GlowCard({ className, color = 'cyan', hover = true, children, ...props }: GlowCardProps) {
  const colors = {
    cyan: 'border-cyan-glow/20 hover:border-cyan-glow/40 hover:shadow-[0_0_20px_rgba(0,240,255,0.15)]',
    gold: 'border-gold/20 hover:border-gold/40 hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]',
    blue: 'border-electric-blue/20 hover:border-electric-blue/40 hover:shadow-[0_0_20px_rgba(0,136,255,0.15)]',
    green: 'border-neon-green/20 hover:border-neon-green/40 hover:shadow-[0_0_20px_rgba(0,255,136,0.15)]',
    red: 'border-neon-red/20 hover:border-neon-red/40 hover:shadow-[0_0_20px_rgba(255,51,102,0.15)]',
  }

  return (
    <div
      className={cn(
        'relative bg-dark-800/50 backdrop-blur-xl border rounded-xl p-5',
        'transition-all duration-300',
        hover && 'card-hover',
        colors[color],
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      {children}
    </div>
  )
}
