import React from 'react';
import type { TextBox } from '../../types';
import { TextBoxItem } from './TextBoxItem';

interface TextBoxOverlayProps {
  textBoxes: TextBox[];
  selectedTextBoxId: string | null;
  editingTextBoxId: string | null;
  onSelectTextBox: (id: string | null) => void;
  onStartEditingTextBox: (id: string) => void;
  onEndEditingTextBox: (id: string, newContent: string) => void;
  onUpdatePosition: (id: string, newX: number, newY: number) => void;
  onCommitPosition: (id: string, oldX: number, oldY: number, newX: number, newY: number) => void;
  onUpdateSize: (id: string, newW: number, newH: number) => void;
  onCommitSize: (id: string, oldW: number, oldH: number, newW: number, newH: number) => void;
  onDeleteTextBox: (id: string) => void;
  onDuplicateTextBox?: (id: string) => void;
  zoom: number;
}

export const TextBoxOverlay: React.FC<TextBoxOverlayProps> = ({
  textBoxes,
  selectedTextBoxId,
  editingTextBoxId,
  onSelectTextBox,
  onStartEditingTextBox,
  onEndEditingTextBox,
  onUpdatePosition,
  onCommitPosition,
  onUpdateSize,
  onCommitSize,
  onDeleteTextBox,
  onDuplicateTextBox,
  zoom,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {textBoxes.map((tb) => (
        <div key={tb.id} style={{ pointerEvents: 'auto' }}>
          <TextBoxItem
            textBox={tb}
            isSelected={tb.id === selectedTextBoxId}
            isEditing={tb.id === editingTextBoxId}
            onSelect={() => onSelectTextBox(tb.id)}
            onStartEditing={() => onStartEditingTextBox(tb.id)}
            onEndEditing={(newContent) => onEndEditingTextBox(tb.id, newContent)}
            onUpdatePosition={(newX, newY) => onUpdatePosition(tb.id, newX, newY)}
            onCommitPosition={(oldX, oldY, newX, newY) =>
              onCommitPosition(tb.id, oldX, oldY, newX, newY)
            }
            onUpdateSize={(newW, newH) => onUpdateSize(tb.id, newW, newH)}
            onCommitSize={(oldW, oldH, newW, newH) =>
              onCommitSize(tb.id, oldW, oldH, newW, newH)
            }
            onDelete={() => onDeleteTextBox(tb.id)}
            onDuplicate={onDuplicateTextBox ? () => onDuplicateTextBox(tb.id) : undefined}
            zoom={zoom}
          />
        </div>
      ))}
    </div>
  );
};
