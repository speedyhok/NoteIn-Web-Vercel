import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import type { PaperType, PaperTemplate, Notebook } from '../../types';
import { Check } from 'lucide-react';

interface CreateNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    title: string,
    color: string,
    coverPattern: Notebook['coverPattern'],
    template: PaperTemplate
  ) => void;
}

const COVER_COLORS = [
  { name: 'Cobalt Blue', value: '#1d4ed8' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Crimson', value: '#dc2626' },
  { name: 'Warm Amber', value: '#d97706' },
  { name: 'Deep Violet', value: '#7c3aed' },
  { name: 'Midnight', value: '#334155' },
];

const PATTERNS: { type: Notebook['coverPattern']; label: string }[] = [
  { type: 'solid', label: 'Classic Solid' },
  { type: 'marble', label: 'Marble Grain' },
  { type: 'minimal', label: 'Minimalist Line' },
  { type: 'gradient', label: 'Silk Gradient' },
];

const TEMPLATES: { type: PaperType; label: string; desc: string }[] = [
  { type: 'ruled', label: 'Ruled Paper', desc: 'Standard horizontal lines with left margin' },
  { type: 'grid', label: 'Grid Paper', desc: 'Square graph grid for diagrams and math' },
  { type: 'dotted', label: 'Dot Grid', desc: 'Subtle dots for bullet journaling' },
  { type: 'cornell', label: 'Cornell Notes', desc: 'Notes, cue column, and summary section' },
  { type: 'blank', label: 'Blank Canvas', desc: 'Clean unlined page for free sketching' },
];

export const CreateNotebookModal: React.FC<CreateNotebookModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState(COVER_COLORS[0].value);
  const [selectedPattern, setSelectedPattern] = useState<Notebook['coverPattern']>('solid');
  const [selectedPaper, setSelectedPaper] = useState<PaperType>('ruled');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const template: PaperTemplate = {
      type: selectedPaper,
      lineSpacing: 28,
      gridSize: 20,
      patternColor: '#dbeafe',
      bgColor: '#ffffff',
    };

    onCreate(title.trim() || 'Untitled Notebook', selectedColor, selectedPattern, template);
    setTitle('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Notebook"
      maxWidth="500px"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              fontWeight: 600,
              boxShadow: '0 2px 8px var(--accent-glow)',
            }}
          >
            Create Notebook
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Notebook Title Input */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            Notebook Title
          </label>
          <input
            type="text"
            placeholder="e.g. Physics Lecture Notes, Journal..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--border-strong)')}
          />
        </div>

        {/* Cover Color Selector */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            Cover Color
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {COVER_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelectedColor(c.value)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: c.value,
                  position: 'relative',
                  border: selectedColor === c.value ? '2px solid #ffffff' : 'none',
                  boxShadow: selectedColor === c.value ? '0 0 0 2px var(--accent-primary)' : 'none',
                }}
                title={c.name}
              >
                {selectedColor === c.value && <Check size={16} color="#ffffff" />}
              </button>
            ))}
          </div>
        </div>

        {/* Cover Texture Pattern */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            Cover Texture
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {PATTERNS.map((p) => (
              <div
                key={p.type}
                onClick={() => setSelectedPattern(p.type)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: selectedPattern === p.type ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: selectedPattern === p.type ? 'var(--accent-light)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                }}
              >
                {p.label}
              </div>
            ))}
          </div>
        </div>

        {/* Paper Template Selector */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            Default Paper Template
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            {TEMPLATES.map((tmpl) => (
              <div
                key={tmpl.type}
                onClick={() => setSelectedPaper(tmpl.type)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: selectedPaper === tmpl.type ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  backgroundColor: selectedPaper === tmpl.type ? 'var(--accent-light)' : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {tmpl.label}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {tmpl.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
};
