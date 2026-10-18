import React from 'react';

interface StrokeWidthPickerProps {
  currentWidth: number;
  onSelectWidth: (width: number) => void;
  toolType: 'pen' | 'highlighter' | 'eraser';
}

const PEN_PRESETS = [
  { label: 'Fine', value: 1.5 },
  { label: 'Medium', value: 3.5 },
  { label: 'Bold', value: 7.0 },
];

const HIGHLIGHTER_PRESETS = [
  { label: 'Narrow', value: 12 },
  { label: 'Standard', value: 20 },
  { label: 'Broad', value: 32 },
];

const ERASER_PRESETS = [
  { label: 'Small', value: 10 },
  { label: 'Medium', value: 20 },
  { label: 'Large', value: 40 },
];

export const StrokeWidthPicker: React.FC<StrokeWidthPickerProps> = ({
  currentWidth,
  onSelectWidth,
  toolType,
}) => {
  const presets =
    toolType === 'highlighter'
      ? HIGHLIGHTER_PRESETS
      : toolType === 'eraser'
      ? ERASER_PRESETS
      : PEN_PRESETS;

  const minRange = toolType === 'highlighter' ? 8 : 1;
  const maxRange = toolType === 'highlighter' ? 48 : toolType === 'eraser' ? 60 : 24;

  return (
    <div
      className="glass-panel animate-scale-up"
      style={{
        padding: '16px',
        borderRadius: 'var(--radius-lg)',
        width: '240px',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Stroke Thickness
        </span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)' }}>
          {currentWidth.toFixed(1)} pt
        </span>
      </div>

      {/* Preset Chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
        {presets.map((p) => {
          const isSelected = Math.abs(currentWidth - p.value) < 0.2;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onSelectWidth(p.value)}
              style={{
                padding: '6px 8px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                fontWeight: isSelected ? 600 : 500,
                border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                backgroundColor: isSelected ? 'var(--accent-light)' : 'var(--bg-primary)',
                color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Slider */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input
          type="range"
          min={minRange}
          max={maxRange}
          step={toolType === 'highlighter' ? 1 : 0.5}
          value={currentWidth}
          onChange={(e) => onSelectWidth(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
        />

        {/* Live Preview Bar */}
        <div
          style={{
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '80%',
              height: `${Math.min(24, Math.max(1, currentWidth))}px`,
              borderRadius: 'var(--radius-full)',
              backgroundColor: toolType === 'eraser' ? 'var(--border-strong)' : 'var(--text-primary)',
              opacity: toolType === 'highlighter' ? 0.45 : 1,
            }}
          />
        </div>
      </div>
    </div>
  );
};
