import React from 'react';
import { StarIcon } from './icons/StarIcon';

interface StarRatingProps {
  rating: number;
  totalStars?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({ rating, totalStars = 5, size = 'md', interactive = false, onRate }) => {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 !== 0;
  const emptyStars = totalStars - fullStars - (halfStar ? 1 : 0);

  const starSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex items-center">
      {[...Array(totalStars)].map((_, index) => {
        const starValue = index + 1;
        return (
          <button
            key={index}
            type="button" // Explicitly set to prevent form submission
            disabled={!interactive}
            onClick={(e) => {
              e.preventDefault(); // Prevent form submission
              if (interactive && onRate) {
                onRate(starValue);
              }
            }}
            className={`
              ${interactive ? 'cursor-pointer' : 'cursor-default'} 
              ${starSizeClasses[size]}
              ${starValue <= rating ? 'text-yellow-500' : 'text-neutral-600'}
              ${interactive ? 'hover:text-yellow-400' : ''}
            `}
            aria-label={interactive ? `Rate ${starValue} stars` : `${starValue} star rating`}
          >
            <StarIcon />
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;