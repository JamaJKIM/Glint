import React, { useState } from 'react';
import './ResponseWindow.css';

interface ResponseWindowProps {
  response: string;
  position: { x: number; y: number };
  onClose: () => void;
  mode: 'search' | 'assignment';
}

export const ResponseWindow: React.FC<ResponseWindowProps> = ({
  response,
  position,
  onClose,
  mode
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [currentPosition, setCurrentPosition] = useState(position);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - currentPosition.x,
      y: e.clientY - currentPosition.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    setCurrentPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`response-window ${mode}`}
      style={{
        left: currentPosition.x,
        top: currentPosition.y
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="response-header">
        <div className="mode-indicator">{mode === 'assignment' ? 'Assignment Help' : 'Search'}</div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="response-content">
        {response}
      </div>
    </div>
  );
}; 