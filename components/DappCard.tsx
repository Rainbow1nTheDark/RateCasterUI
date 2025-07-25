
import React from 'react';
import { DappRegistered } from '../types';
import StarRating from './StarRating';
import { PencilIcon } from './icons/PencilIcon';
import { ChatBubbleOvalLeftEllipsisIcon } from './icons/ChatBubbleOvalLeftEllipsisIcon';

interface DappCardProps {
  dapp: DappRegistered;
  isLoading: boolean;
  userAddress: string | null;
  startEditDapp: (dapp: DappRegistered) => void;
  openRatingModal: (dappId: string) => void;
  onNavigateToDetail: (dappId: string) => void;
}

const DappCard: React.FC<DappCardProps> = ({ dapp, isLoading, userAddress, startEditDapp, openRatingModal, onNavigateToDetail }) => {
  const canEdit = userAddress && dapp.owner && userAddress.toLowerCase() === dapp.owner.toLowerCase();

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent navigation if a button inside the card was clicked
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onNavigateToDetail(dapp.dappId);
  };

  return (
    <div 
      className="bg-neutral-800 rounded-xl shadow-lg p-5 flex flex-col h-full min-h-[250px] transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/20 hover:-translate-y-1 cursor-pointer"
      onClick={handleCardClick}
      role="link" // Semantically it acts as a link
      tabIndex={0} // Make it focusable
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(e as any); }} // Keyboard accessible
      aria-label={`View details for ${dapp.name}`}
    >
      {/* Content */}
      <div className="flex flex-col flex-grow">
        <h3 className="text-lg font-semibold text-yellow-500 mb-1 truncate" title={dapp.name}>
          {dapp.name}
        </h3>
        <p className="text-xs text-neutral-400 mb-2 uppercase tracking-wide">{dapp.category || 'Uncategorized'}</p>
        <p className="text-sm text-neutral-300 mb-3 flex-grow line-clamp-3">{dapp.description}</p>
        <div className="flex items-center mb-3">
          <StarRating rating={dapp.averageRating || 0} size="sm" />
          <span className="ml-2 text-xs text-neutral-400">
            ({(dapp.averageRating || 0).toFixed(1)} from {dapp.totalReviews || 0})
          </span>
        </div>
        <a
          href={dapp.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()} // Prevent card click when URL is clicked
          className="text-xs text-yellow-600 hover:text-yellow-500 truncate block mb-3"
          aria-label={`Visit website for ${dapp.name} (opens in new tab)`}
        >
          {dapp.url}
        </a>
      </div>

      {/* Buttons */}
      <div className="mt-auto pt-3 border-t border-neutral-700 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click
            openRatingModal(dapp.dappId);
          }}
          disabled={isLoading || !userAddress}
          className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-neutral-900 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200"
          aria-label={`Rate ${dapp.name}`}
        >
          <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4 mr-1" />
          Rate
        </button>
        {canEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent card click
              startEditDapp(dapp);
            }}
            disabled={isLoading}
            className="flex-1 bg-neutral-600 hover:bg-neutral-500 text-neutral-100 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200"
            aria-label={`Edit ${dapp.name}`}
          >
            <PencilIcon className="w-4 h-4 mr-1" />
            Edit
          </button>
        )}
      </div>
    </div>
  );
};

export default DappCard;
