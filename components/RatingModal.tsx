
import React from 'react';
import { DappRegistered, DappReview } from '../types';
import Spinner from './Spinner';
import StarRating from './StarRating';

interface RatingModalProps {
  ratingModalOpen: boolean;
  dapps: DappRegistered[]; 
  reviewData: Partial<Pick<DappReview, 'dappId' | 'reviewText'>> & { rating: number };
  isLoading: boolean;
  handleReviewChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleStarRatingChange: (rating: number) => void;
  handleSubmitReview: (e: React.FormEvent) => Promise<void>;
  setRatingModalOpen: (open: boolean) => void;
}

const RatingModal: React.FC<RatingModalProps> = ({
  ratingModalOpen,
  dapps,
  reviewData,
  isLoading,
  handleReviewChange,
  handleStarRatingChange,
  handleSubmitReview,
  setRatingModalOpen,
}) => {
  if (!ratingModalOpen) return null;

  const selectedDapp = dapps.find(d => d.dappId === reviewData.dappId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-neutral-800 p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-lg transform transition-all duration-300 scale-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-yellow-500">
            Rate {selectedDapp?.name || 'Dapp'}
          </h2>
          <button 
            onClick={() => setRatingModalOpen(false)} 
            className="text-neutral-400 hover:text-neutral-200 text-2xl"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmitReview} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Your Rating</label>
            <div className="flex justify-center sm:justify-start">
               <StarRating rating={reviewData.rating} size="lg" interactive={true} onRate={handleStarRatingChange} />
            </div>
            {/* Hidden input to satisfy traditional form patterns if needed, though not strictly necessary with controlled components */}
            <input type="hidden" name="rating" value={reviewData.rating} />
          </div>
          <div>
            <label htmlFor="reviewText" className="block text-sm font-medium text-neutral-300 mb-1">Your Review (Optional)</label>
            <textarea
              name="reviewText"
              id="reviewText"
              value={reviewData.reviewText || ''}
              onChange={handleReviewChange}
              rows={4}
              className="w-full px-4 py-2.5 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-colors"
              placeholder="Share your thoughts..."
            />
          </div>
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto flex-1 bg-yellow-500 hover:bg-yellow-600 text-neutral-900 px-6 py-3 rounded-lg text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-150"
            >
              {isLoading ? <Spinner size="sm" color="border-neutral-900" /> : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RatingModal;
