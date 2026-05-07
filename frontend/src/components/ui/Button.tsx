import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    className={`axis-button axis-button--${variant} axis-button--${size} ${className}`.trim()}
    type={type}
    {...props}
  >
    {children}
  </button>
);

export default Button;
