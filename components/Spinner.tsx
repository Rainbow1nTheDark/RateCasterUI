
import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string; // Tailwind color class e.g. border-yellow-500
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'border-yellow-500' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div
      className={`animate-spin-custom rounded-full ${sizeClasses[size]} ${color} border-t-transparent`}
    ></div>
  );
};

export default Spinner;
