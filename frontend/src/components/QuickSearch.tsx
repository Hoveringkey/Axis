import React from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';

interface QuickSearchProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const QuickSearch: React.FC<QuickSearchProps> = ({ value, onChange }) => {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <MagnifyingGlass 
        size={16} 
        style={{ 
          position: 'absolute', 
          left: '12px', 
          color: 'var(--text-muted)' 
        }} 
      />
      <input
        type="text"
        placeholder="Buscar"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '0.4rem 1rem 0.4rem 36px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          background: 'var(--card-bg)',
          color: 'var(--text-main)',
          fontSize: '0.85rem',
          outline: 'none',
          transition: 'all 0.2s ease',
          width: '12rem'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--accent-primary)';
          e.target.style.boxShadow = '0 0 0 2px rgba(79, 70, 229, 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border-color)';
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
  );
};

export default QuickSearch;
