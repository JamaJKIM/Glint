import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Processing...' }) => {
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <div className="message">{message}</div>
    </div>
  );
}; 