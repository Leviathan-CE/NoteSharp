import React, { useRef } from 'react';
import DraggableWrapper from '../functional/DraggableWrapper';
import ResizableWrapper from '../functional/ResizableWrapper';

interface ImageCardProps {
  id: string;
  src: string;
  initialPosition?: { x: number; y: number };
  initialSize?: { width: number; height: number };
  onPositionChange?: (id: string, position: { x: number; y: number }) => void;
  onSizeChange?: (id: string, size: { width: number; height: number }) => void;
  onReplaceImage?: (id: string, file: File) => void;
  onDelete?: (id: string) => void;
  onClick?: () => void;
  isSelected?: boolean;
  altText?: string;
  /** Callback when mouse down occurs on the card */
  onMouseDown?: (id: string) => void;
  /** Current zoom level (default: 1) - used to scale movement */
  zoom?: number;
}

/**
 * ImageCard Component
 *
 * A draggable, resizable container for uploaded images.
 * Provides inline replace/delete controls when hovered similar to Milanote.
 */
export function ImageCard({
  id,
  src,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 320, height: 240 },
  onPositionChange,
  onSizeChange,
  onReplaceImage,
  onDelete,
  onClick,
  isSelected = false,
  altText = 'Uploaded image',
  onMouseDown,
  zoom = 1,
}: ImageCardProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleReplace = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onReplaceImage) return;

    onReplaceImage(id, file);
    event.target.value = '';
  };

  const stopDragPropagation = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(id);
    }
  };

  const handleSizeChange = (size: { width: number; height: number }) => {
    if (onSizeChange) {
      onSizeChange(id, size);
    }
  };

  return (
    <DraggableWrapper
      id={id}
      initialPosition={initialPosition}
      onPositionChange={onPositionChange}
      onMouseDown={onMouseDown}
      zoom={zoom}
    >
      <ResizableWrapper
        initialSize={initialSize}
        minWidth={150}
        minHeight={120}
        onSizeChange={handleSizeChange}
        className="group"
      >
        <div
          data-image={id}
          className={`h-full w-full bg-white rounded-lg overflow-hidden relative flex items-center justify-center ${
            isSelected ? 'border-2 border-blue-500' : 'border border-gray-200'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (onClick) {
              onClick();
            }
          }}
        >
          {src ? (
            <img
              src={src}
              alt={altText}
              className="object-contain w-full h-full select-none pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="text-gray-400 text-sm">No image selected</div>
          )}

          {/* Floating controls */}
          <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onReplaceImage && (
              <button
                type="button"
                onMouseDown={stopDragPropagation}
                onClick={handleReplace}
                className="px-2 py-1 rounded bg-white/90 text-gray-700 text-xs shadow hover:bg-gray-100 border border-gray-200"
              >
                Replace
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onMouseDown={stopDragPropagation}
                onClick={handleDeleteClick}
                className="px-2 py-1 rounded bg-white/90 text-red-600 text-xs shadow hover:bg-red-50 border border-red-200"
              >
                Delete
              </button>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>
      </ResizableWrapper>
    </DraggableWrapper>
  );
}

export default ImageCard;
