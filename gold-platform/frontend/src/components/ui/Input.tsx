import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-[#8888aa]">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888aa]">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg px-4 py-2.5',
              'text-[#e0e0ff] placeholder-[#8888aa]/50',
              'focus:outline-none focus:border-cyan-glow/50 focus:ring-1 focus:ring-cyan-glow/30',
              'transition-all duration-300',
              icon && 'pl-10',
              error && 'border-neon-red/50 focus:border-neon-red/50 focus:ring-neon-red/30',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-neon-red">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
