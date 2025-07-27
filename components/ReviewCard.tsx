import React from 'react';
import { DappReview } from '../types';

interface ReviewCardProps {
  review: DappReview;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  return (
    <div className="bg-neutral-800 rounded-xl shadow-lg p-4 w-full max-w-[300px] flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/20">
      <h3 className="text-lg font-semibold text-yellow-500 mb-1 truncate" title={review.dappName}>
        {review.dappName || 'Unknown Dapp'}
      </h3>
      <div className="flex items-center mb-2">
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <span key={i} className={i < review.starRating ? 'text-yellow-500' : 'text-neutral-500'}>
              ★
            </span>
          ))}
        </div>
        <span className="ml-2 text-xs text-neutral-400">({review.starRating})</span>
      </div>
      <p className="text-sm text-neutral-300 mb-3 flex-grow line-clamp-3">{review.reviewText || 'No review text'}</p>
      <p className="text-xs text-neutral-400">By: {review.rater.slice(0, 6)}...{review.rater.slice(-4)}</p>
    </div>
  );
};

export default ReviewCard;