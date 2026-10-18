import React from 'react';
import type { PaperType, PaperTemplate } from '../../types';
import { Modal } from '../common/Modal';

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentTemplate: PaperTemplate;
  onSelectTemplate: (template: PaperTemplate) => void;
}

const TEMPLATES: { type: PaperType; title: string; subtitle: string; iconSvg: React.ReactNode }[] = [
  {
    type: 'ruled',
    title: 'Ruled / Lined',
    subtitle: 'Classic lined notebook with red margin',
    iconSvg: (
      <svg width="48" height="60" viewBox="0 0 48 60" fill="none">
        <rect width="48" height="60" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="10" y1="0" x2="10" y2="60" stroke="#fca5a5" strokeWidth="1.5" />
        <line x1="0" y1="16" x2="48" y2="16" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="0" y1="28" x2="48" y2="28" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="0" y1="40" x2="48" y2="40" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="0" y1="52" x2="48" y2="52" stroke="#cbd5e1" strokeWidth="1" />
      </svg>
    ),
  },
  {
    type: 'grid',
    title: 'Square Grid',
    subtitle: 'Graph paper for math, engineering & sketches',
    iconSvg: (
      <svg width="48" height="60" viewBox="0 0 48 60" fill="none">
        <rect width="48" height="60" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="12" y1="0" x2="12" y2="60" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="24" y1="0" x2="24" y2="60" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="36" y1="0" x2="36" y2="60" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="0" y1="15" x2="48" y2="15" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="0" y1="30" x2="48" y2="30" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="0" y1="45" x2="48" y2="45" stroke="#e2e8f0" strokeWidth="1" />
      </svg>
    ),
  },
  {
    type: 'dotted',
    title: 'Dot Matrix',
    subtitle: 'Minimalist dots for bullet journaling',
    iconSvg: (
      <svg width="48" height="60" viewBox="0 0 48 60" fill="none">
        <rect width="48" height="60" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx="12" cy="15" r="1.5" fill="#94a3b8" />
        <circle cx="24" cy="15" r="1.5" fill="#94a3b8" />
        <circle cx="36" cy="15" r="1.5" fill="#94a3b8" />
        <circle cx="12" cy="30" r="1.5" fill="#94a3b8" />
        <circle cx="24" cy="30" r="1.5" fill="#94a3b8" />
        <circle cx="36" cy="30" r="1.5" fill="#94a3b8" />
        <circle cx="12" cy="45" r="1.5" fill="#94a3b8" />
        <circle cx="24" cy="45" r="1.5" fill="#94a3b8" />
        <circle cx="36" cy="45" r="1.5" fill="#94a3b8" />
      </svg>
    ),
  },
  {
    type: 'cornell',
    title: 'Cornell Notes',
    subtitle: 'Standard header, left cue column, summary block',
    iconSvg: (
      <svg width="48" height="60" viewBox="0 0 48 60" fill="none">
        <rect width="48" height="60" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
        <line x1="0" y1="12" x2="48" y2="12" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="16" y1="12" x2="16" y2="46" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="0" y1="46" x2="48" y2="46" stroke="#94a3b8" strokeWidth="1.5" />
        <line x1="16" y1="22" x2="48" y2="22" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="16" y1="32" x2="48" y2="32" stroke="#e2e8f0" strokeWidth="1" />
        <line x1="16" y1="40" x2="48" y2="40" stroke="#e2e8f0" strokeWidth="1" />
      </svg>
    ),
  },
  {
    type: 'blank',
    title: 'Blank Paper',
    subtitle: 'Clean white space with zero distractions',
    iconSvg: (
      <svg width="48" height="60" viewBox="0 0 48 60" fill="none">
        <rect width="48" height="60" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
      </svg>
    ),
  },
];

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  isOpen,
  onClose,
  currentTemplate,
  onSelectTemplate,
}) => {
  const handleSelect = (type: PaperType) => {
    onSelectTemplate({
      ...currentTemplate,
      type,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Paper Template" maxWidth="520px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {TEMPLATES.map((t) => {
          const isSelected = currentTemplate.type === t.type;
          return (
            <div
              key={t.type}
              onClick={() => handleSelect(t.type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                backgroundColor: isSelected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-strong)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <div style={{ flexShrink: 0 }}>{t.iconSvg}</div>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t.title}
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {t.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
