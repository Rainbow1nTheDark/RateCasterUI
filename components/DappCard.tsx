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
}

const DappCard: React.FC<DappCardProps> = ({ dapp, isLoading, userAddress, startEditDapp, openRatingModal }) => {
  const canEdit = userAddress && dapp.owner && userAddress.toLowerCase() === dapp.owner.toLowerCase();

  return (
    <div className="bg-neutral-800 rounded-xl shadow-lg p-4 flex flex-col h-full min-h-[400px] transition-all duration-300 hover:shadow-xl hover:shadow-yellow-500/20 hover:-translate-y-1">
      {/* Image */}
      <div className="relative w-full aspect-[2/1] mb-3">
        <img
          src={dapp.imageUrl || `https://picsum.photos/seed/${dapp.dappId}/400/200`}
          alt={dapp.name}
          className="w-full h-full object-contain rounded-lg bg-neutral-700"
          onError={(e) => (e.currentTarget.src = `https://picsum.photos/seed/${dapp.dappId}/400/200`)}
        />
      </div>

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
          className="text-xs text-yellow-600 hover:text-yellow-500 truncate block mb-3"
        >
          {dapp.url}
        </a>
      </div>

      {/* Buttons */}
      <div className="mt-auto pt-3 border-t border-neutral-700 flex gap-2">
        <button
          onClick={() => openRatingModal(dapp.dappId)}
          disabled={isLoading || !userAddress}
          className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-neutral-900 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200"
          aria-label={`Rate ${dapp.name}`}
        >
          <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4 mr-1" />
          Rate
        </button>
        {canEdit && (
          <button
            onClick={() => startEditDapp(dapp)}
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