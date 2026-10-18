import React from 'react';
import { Pipette } from 'lucide-react';

interface ColorPickerProps {
  currentColor: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}

// 12 Curated NoteIn Swatches (Deep Ink, Ocean Blue, Teal, Emerald, Forest, Mustard, Coral, Wine, Plum, Graphite, White, Charcoal)
export const PALETTE = [
  { name: 'Pitch Black', value: '#0f172a' },
  { name: 'Royal Blue', value: '#1d4ed8' },
  { name: 'Sky Azure', value: '#0284c7' },
  { name: 'Deep Teal', value: '#0f766e' },
  { name: 'Emerald', value: '#16a34a' },
  { name: 'Warm Amber', value: '#d97706' },
  { name: 'Coral Red', value: '#dc2626' },
  { name: 'Rose Wine', value: '#be185d' },
  { name: 'Amethyst', value: '#7e22ce' },
  { name: 'Slate Gray', value: '#64748b' },
  { name: 'Highlight Yellow', value: '#facc15' },
  { name: 'Pure White', value: '#ffffff' },
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  currentColor,
  onSelectColor,
  onClose,
}) => {
  return (
    <div
      className="glass-panel animate-scale-up"
      style={{
        padding: '14px',
        borderRadius: 'var(--radius-lg)',
        width: '220px',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
        Ink Palette
      </div>

      {/* Swatch Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
        }}
      >
        {PALETTE.map((c) => {
          const isSelected = currentColor.toLowerCase() === c.value.toLowerCase();
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => {
                onSelectColor(c.value);
                onClose();
              }}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: c.value,
                border: c.value === '#ffffff' ? '1px solid var(--border-strong)' : 'none',
                position: 'relative',
                boxShadow: isSelected ? '0 0 0 2px var(--bg-secondary), 0 0 0 4px var(--accent-primary)' : '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'transform var(--transition-fast)',
              }}
              title={c.name}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1.0)')}
            />
          );
        })}
      </div>

      {/* Custom Color Native Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <Pipette size={14} />
          Custom HEX
        </div>
        <input
          type="color"
          value={currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#1d4ed8'}
          onChange={(e) => onSelectColor(e.target.value)}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            background: 'none',
          }}
        />
      </div>
    </div>
  );
};
