
import React, { useEffect, useState } from 'react';
import { DappReview } from '../types';
import { StarIcon } from './icons/StarIcon';

interface NotificationProps {
  review: DappReview | null;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ review, onClose }: NotificationProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (review) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Call onClose after animation finishes
        setTimeout(onClose, 500); 
      }, 5000); // Display for 5 seconds
      return () => clearTimeout(timer);
    }
  }, [review, onClose]);

  if (!review) return null;

  // Use new animation classes from index.html for top appearance
  const animationClass = isVisible ? 'animate-slide-in-down' : 'animate-slide-out-up';

  return (
    <div
      className={`fixed top-5 left-5 bg-neutral-800 text-neutral-200 p-4 rounded-lg shadow-2xl z-50 max-w-sm ${animationClass}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-yellow-500">New Review!</h4>
        <button 
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 500); // Ensure onClose is called if manually closed
          }} 
          className="text-neutral-400 hover:text-neutral-200 text-xl leading-none"
          aria-label="Close notification"
        >
          &times;
        </button>
      </div>
      <p className="text-sm">
        <span className="font-semibold">{review.dappName || 'A dApp'}</span> received a new rating:
      </p>
      <div className="flex items-center mt-1">
        {[...Array(5)].map((_, i) => (
          <StarIcon key={i} className={`w-5 h-5 ${i < review.starRating ? 'text-yellow-500' : 'text-neutral-600'}`} />
        ))}
        <span className="ml-2 text-sm">({review.starRating} stars)</span>
      </div>
      {review.reviewText && <p className="mt-2 text-xs italic text-neutral-400 line-clamp-2">"{review.reviewText}"</p>}
    </div>
  );
};

export default Notification;