import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#0A84FF] text-white hover:bg-[#0077ED] focus-visible:ring-[#0A84FF]',
  secondary: 'bg-white text-[#111111] border border-[#D2D2D7] hover:bg-[#F5F5F7] focus-visible:ring-[#111111]',
  ghost: 'bg-transparent text-[#111111] hover:bg-[#F5F5F7] focus-visible:ring-[#111111]',
  danger: 'bg-[#F5F5F7] text-[#B42318] border border-[#E6C7C5] hover:bg-[#FDECEC] focus-visible:ring-[#B42318]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  leadingIcon,
  trailingIcon,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {leadingIcon ? <span className="inline-flex items-center">{leadingIcon}</span> : null}
      {children}
      {trailingIcon ? <span className="inline-flex items-center">{trailingIcon}</span> : null}
    </button>
  );
}
