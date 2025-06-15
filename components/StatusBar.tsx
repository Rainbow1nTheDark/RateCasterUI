// components/StatusBar.tsx
import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Spinner from './Spinner';
import { WalletIcon } from './icons/WalletIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ExclamationCircleIcon } from './icons/ExclamationCircleIcon';
import { UserProfile, RankInfo, getRankAndLeague } from '../types'; 
import { StarIcon } from './icons/StarIcon';
import { FireIcon } from './icons/FireIcon';
import { QuestsIcon } from './icons/QuestsIcon';
import { LeagueIcon } from './icons/LeagueIcon'; // New League Icon
import { ActiveTab } from './Tabs';

interface StatusBarProps {
  appStatus: string; // Changed from sdkStatus for broader UI messages
  userAddress: string | null;
  userProfile: UserProfile | null;
  isLoading: boolean; // For initial load or connect button busy state
  currentChainName?: string;
  setActiveTab: (tab: ActiveTab) => void;
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  appStatus, 
  userAddress, 
  userProfile, 
  isLoading, 
  currentChainName,
  setActiveTab
}) => {
  const isWalletEffectivelyConnected = !!userAddress;
  let rankInfo: RankInfo | null = null;
  if (userProfile) {
    rankInfo = getRankAndLeague(userProfile.points);
  }

  const getStatusIndicator = () => {
    // Show spinner if isLoading (core data for app) or if appStatus implies connection attempt
    if (isLoading || appStatus.toLowerCase().includes("connecting") || appStatus.toLowerCase().includes("initializing") || appStatus.toLowerCase().includes("fetching")) {
      return <Spinner size="sm" color="border-yellow-500" />;
    }
    if (appStatus.toLowerCase().includes("error") || appStatus.toLowerCase().includes("failed")) {
      return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
    }
    if (isWalletEffectivelyConnected) { // If wallet is connected and no errors/loading, show check
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
    }
    return <ExclamationCircleIcon className="w-5 h-5 text-neutral-500" />; // Default for disconnected, not loading
  };
  
  const getDisplayStatusMessage = () => {
    if (appStatus.toLowerCase().includes("error") || appStatus.toLowerCase().includes("failed")) return appStatus;
    if (isWalletEffectivelyConnected && currentChainName) return currentChainName;
    if (isLoading) return "Loading App Data...";
    if (appStatus.toLowerCase().includes("connecting")) return "Connecting Wallet...";
    return "Ready"; // Default or non-critical status
  };

  return (
    <div className="p-3 sm:p-4 bg-neutral-800 rounded-xl shadow-lg flex flex-col lg:flex-row justify-between items-center space-y-3 lg:space-y-0 lg:space-x-4">
      <div className="flex items-center space-x-2 text-sm">
        {getStatusIndicator()}
        <span className="text-neutral-300">
          {getDisplayStatusMessage()}
        </span>
      </div>

      {isWalletEffectivelyConnected && userProfile && rankInfo && (
        <div className="flex flex-wrap justify-center items-center gap-x-3 sm:gap-x-4 gap-y-2 text-xs sm:text-sm">
          <div className={`flex items-center ${rankInfo.iconColor}`}>
            <LeagueIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
            <span>{rankInfo.league}</span>
          </div>
          <div className="flex items-center text-yellow-400">
            <StarIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
            <span>{userProfile.points}</span>
          </div>
          <div className="flex items-center text-orange-400">
            <FireIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
            <span>{userProfile.reviewStreak}</span>
          </div>
          {rankInfo.nextLeague && rankInfo.nextLeaguePoints && rankInfo.progressPercentage !== undefined && (
            <div className="w-full lg:w-auto flex items-center justify-center lg:justify-start">
              <div className="text-xs text-neutral-400 mr-1.5">Next:</div>
              <div className="w-16 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${rankInfo.iconColor.replace('text-', 'bg-')}`} 
                  style={{ width: `${rankInfo.progressPercentage}%`}}
                ></div>
              </div>
            </div>
          )}
          <button
            onClick={() => setActiveTab('quests')}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-xs font-medium flex items-center transition-colors"
          >
            <QuestsIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
            Quests
          </button>
        </div>
      )}

      <div className="flex items-center">
        <ConnectButton 
          showBalance={false} 
          chainStatus="icon" 
          accountStatus={{
            smallScreen: 'avatar',
            largeScreen: 'full',
          }}
        />
      </div>
    </div>
  );
};

export default StatusBar;