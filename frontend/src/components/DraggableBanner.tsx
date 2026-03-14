import { useState, useRef, useCallback } from 'react';
import { Move } from 'lucide-react';

interface Props {
  imageUrl: string;
  altText?: string;
  position?: string;
  canEdit?: boolean;
  onPositionChange?: (position: string) => void;
  className?: string;
  children?: React.ReactNode;
}

export default function DraggableBanner({
  imageUrl, altText = '', position = '50% 50%',
  canEdit = false, onPositionChange, className = 'w-full h-full', children
}: Props) {
  const [currentPosition, setCurrentPosition] = useState(position);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsePosition = (pos: string) => {
    const parts = pos.split(' ');
    return {
      x: parseFloat(parts[0]) || 50,
      y: parseFloat(parts[1]) || 50,
    };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isEditMode) return;
    e.preventDefault();
    const { x, y } = parsePosition(currentPosition);
    dragStart.current = { x: e.clientX, y: e.clientY, px: x, py: y };
    setIsDragging(true);

    const handleMouseMove = (moveE: MouseEvent) => {
      if (!dragStart.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((moveE.clientX - dragStart.current.x) / rect.width) * -100;
      const dy = ((moveE.clientY - dragStart.current.y) / rect.height) * -100;
      const newX = Math.max(0, Math.min(100, dragStart.current.px + dx));
      const newY = Math.max(0, Math.min(100, dragStart.current.py + dy));
      const newPos = `${newX.toFixed(1)}% ${newY.toFixed(1)}%`;
      setCurrentPosition(newPos);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStart.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Save position
      setCurrentPosition(prev => {
        onPositionChange?.(prev);
        return prev;
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isEditMode, currentPosition, onPositionChange]);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isEditMode) return;
    const touch = e.touches[0];
    const { x, y } = parsePosition(currentPosition);
    dragStart.current = { x: touch.clientX, y: touch.clientY, px: x, py: y };
    setIsDragging(true);

    const handleTouchMove = (moveE: TouchEvent) => {
      if (!dragStart.current || !containerRef.current) return;
      const t = moveE.touches[0];
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((t.clientX - dragStart.current.x) / rect.width) * -100;
      const dy = ((t.clientY - dragStart.current.y) / rect.height) * -100;
      const newX = Math.max(0, Math.min(100, dragStart.current.px + dx));
      const newY = Math.max(0, Math.min(100, dragStart.current.py + dy));
      setCurrentPosition(`${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      dragStart.current = null;
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      setCurrentPosition(prev => {
        onPositionChange?.(prev);
        return prev;
      });
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  }, [isEditMode, currentPosition, onPositionChange]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <img
        src={imageUrl}
        alt={altText}
        className="w-full h-full object-cover transition-none select-none"
        style={{
          objectPosition: currentPosition,
          cursor: isEditMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
          userSelect: 'none',
          pointerEvents: isEditMode ? 'auto' : 'none',
        }}
        draggable={false}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      />

      {/* Edit mode overlay */}
      {isEditMode && (
        <div className="absolute inset-0 border-4 border-dashed border-white/70 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/50 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5" /> Drag to reposition
          </div>
        </div>
      )}

      {/* Edit toggle button */}
      {canEdit && (
        <button
          onClick={() => setIsEditMode(e => !e)}
          className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full shadow-lg transition z-10 ${isEditMode ? 'bg-green-500 text-white' : 'bg-white/90 text-gray-700 hover:bg-white'}`}
        >
          <Move className="w-3.5 h-3.5" />
          {isEditMode ? '✅ Save Position' : 'Reposition'}
        </button>
      )}

      {/* Pass through children (overlays, buttons, etc.) */}
      {children}
    </div>
  );
}
