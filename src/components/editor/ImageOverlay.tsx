import React from 'react';
import type { NoteImage, ToolType } from '../../types';
import { ImageItem } from './ImageItem';

interface ImageOverlayProps {
  images: NoteImage[];
  selectedImageId: string | null;
  onSelectImage: (id: string | null) => void;
  onUpdatePosition: (id: string, newX: number, newY: number) => void;
  onCommitPosition: (id: string, oldX: number, oldY: number, newX: number, newY: number) => void;
  onUpdateSize: (id: string, newW: number, newH: number) => void;
  onCommitSize: (id: string, oldW: number, oldH: number, newW: number, newH: number) => void;
  onDeleteImage: (id: string) => void;
  onDuplicateImage?: (id: string) => void;
  zoom: number;
  activeTool: ToolType;
}

export const ImageOverlay: React.FC<ImageOverlayProps> = ({
  images,
  selectedImageId,
  onSelectImage,
  onUpdatePosition,
  onCommitPosition,
  onUpdateSize,
  onCommitSize,
  onDeleteImage,
  onDuplicateImage,
  zoom,
  activeTool,
}) => {
  // Allow interaction when not actively in pen, highlighter, or eraser
  const canInteract = activeTool === 'pan' || activeTool === 'lasso' || activeTool === 'text';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {images.map((img) => (
        <div key={img.id} style={{ pointerEvents: canInteract ? 'auto' : 'none' }}>
          <ImageItem
            image={img}
            isSelected={img.id === selectedImageId}
            onSelect={() => onSelectImage(img.id)}
            onUpdatePosition={(newX, newY) => onUpdatePosition(img.id, newX, newY)}
            onCommitPosition={(oldX, oldY, newX, newY) =>
              onCommitPosition(img.id, oldX, oldY, newX, newY)
            }
            onUpdateSize={(newW, newH) => onUpdateSize(img.id, newW, newH)}
            onCommitSize={(oldW, oldH, newW, newH) =>
              onCommitSize(img.id, oldW, oldH, newW, newH)
            }
            onDelete={() => onDeleteImage(img.id)}
            onDuplicate={onDuplicateImage ? () => onDuplicateImage(img.id) : undefined}
            zoom={zoom}
            canInteract={canInteract}
          />
        </div>
      ))}
    </div>
  );
};
