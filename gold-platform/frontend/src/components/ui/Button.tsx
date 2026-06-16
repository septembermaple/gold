import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'
  size?: 'sm' | 'md' | 'lg'
  glow?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', glow = false, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-900 disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary: 'bg-cyan-glow/20 text-cyan-glow border border-cyan-glow/30 hover:bg-cyan-glow/30 hover:border-cyan-glow/50 focus:ring-cyan-glow/50',
      secondary: 'bg-electric-blue/20 text-electric-blue border border-electric-blue/30 hover:bg-electric-blue/30 hover:border-electric-blue/50 focus:ring-electric-blue/50',
      ghost: 'bg-transparent text-[#8888aa] border border-transparent hover:bg-white/5 hover:text-[#e0e0ff] focus:ring-white/20',
      danger: 'bg-neon-red/20 text-neon-red border border-neon-red/30 hover:bg-neon-red/30 hover:border-neon-red/50 focus:ring-neon-red/50',
      gold: 'bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 hover:border-gold/50 focus:ring-gold/50',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-xs gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-3 text-base gap-2.5',
    }

    const glowEffect = glow
      ? variant === 'gold'
        ? 'glow-border-gold'
        : 'glow-border'
      : ''

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], glowEffect, 'btn-glow', className)}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
