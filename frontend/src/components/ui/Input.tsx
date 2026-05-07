import type { InputHTMLAttributes } from 'react';
import './ui.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

const Input = ({ className = '', error, id, label, ...props }: InputProps) => {
  const inputId = id ?? props.name;

  return (
    <label className={`axis-input ${error ? 'axis-input--error' : ''} ${className}`.trim()}>
      <span className="axis-input__label">{label}</span>
      <input className="axis-input__control" id={inputId} aria-invalid={Boolean(error)} {...props} />
      {error && <span className="axis-input__error">{error}</span>}
    </label>
  );
};

export default Input;
