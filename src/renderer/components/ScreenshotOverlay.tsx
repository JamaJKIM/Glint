import React, { useEffect, useState, useCallback, useRef } from 'react';
import { CaptureRegion } from '../../types/screenshot';
import { captureScreenshot } from '../screenshot';

interface ScreenshotOverlayProps {
  onClose: () => void;
  onScreenshotTaken: (filePath: string) => void;
}

export const ScreenshotOverlay: React.FC<ScreenshotOverlayProps> = ({ onClose, onScreenshotTaken }) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!overlayRef.current) return;
    
    const rect = overlayRef.current.getBoundingClientRect();
    setIsSelecting(true);
    setSelectionStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !overlayRef.current) return;
    
    const rect = overlayRef.current.getBoundingClientRect();
    setSelectionEnd({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  }, [isSelecting]);

  const handleMouseUp = useCallback(async () => {
    if (!selectionStart || !selectionEnd || !isSelecting) return;

    setIsSelecting(false);

    const region: CaptureRegion = {
      x: Math.min(selectionStart.x, selectionEnd.x),
      y: Math.min(selectionStart.y, selectionEnd.y),
      width: Math.abs(selectionEnd.x - selectionStart.x),
      height: Math.abs(selectionEnd.y - selectionStart.y)
    };

    try {
      const result = await captureScreenshot(region);
      if (result.success && result.data) {
        onScreenshotTaken(result.data);
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }

    onClose();
  }, [selectionStart, selectionEnd, isSelecting, onClose, onScreenshotTaken]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getSelectionStyle = () => {
    if (!selectionStart || !selectionEnd) return null;

    return {
      left: Math.min(selectionStart.x, selectionEnd.x),
      top: Math.min(selectionStart.y, selectionEnd.y),
      width: Math.abs(selectionEnd.x - selectionStart.x),
      height: Math.abs(selectionEnd.y - selectionStart.y)
    };
  };

  const selectionStyle = getSelectionStyle();

  return (
    <div
      ref={overlayRef}
      className="screenshot-overlay"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="overlay-instructions">
        Click and drag to select a region for the screenshot
      </div>
      {selectionStyle && (
        <div
          className="selection-box"
          style={selectionStyle}
        />
      )}
    </div>
  );
}; 