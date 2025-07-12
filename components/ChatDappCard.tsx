
import React from 'react';
import { DappRegistered } from '../types';
import StarRating from './StarRating';

interface ChatDappCardProps {
  dapp: DappRegistered;
  onNavigateToDetail: (dappId: string) => void;
}

const ChatDappCard: React.FC<ChatDappCardProps> = ({ dapp, onNavigateToDetail }) => {

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onNavigateToDetail(dapp.dappId);
  };

  return (
    <div 
      className="bg-neutral-700 rounded-lg p-3 flex flex-col h-full min-h-[150px] transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20 hover:-translate-y-1 cursor-pointer"
      onClick={handleCardClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(e as any); }}
      aria-label={`View details for ${dapp.name}`}
    >
      <div className="flex flex-col flex-grow">
        <h3 className="text-md font-semibold text-yellow-500 mb-1 truncate" title={dapp.name}>
          {dapp.name}
        </h3>
        <p className="text-xs text-neutral-400 mb-2 uppercase tracking-wide">{dapp.category || 'Uncategorized'}</p>
        <p className="text-sm text-neutral-300 mb-3 flex-grow line-clamp-2">{dapp.description}</p>
        <div className="flex items-center mb-3">
          <StarRating rating={dapp.averageRating || 0} size="xs" />
          <span className="ml-2 text-xs text-neutral-400">
            ({(dapp.averageRating || 0).toFixed(1)} from {dapp.totalReviews || 0})
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatDappCard;
