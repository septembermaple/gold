import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean
  variant?: 'default' | 'dark' | 'bordered'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glow = false, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'glass',
      dark: 'glass-dark',
      bordered: 'bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-xl',
    }

    return (
      <div
        ref={ref}
        className={cn(variants[variant], glow && 'glow-border', 'p-6', className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export default Card
