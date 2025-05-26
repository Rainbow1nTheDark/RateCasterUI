
import React from 'react';
import Spinner from './Spinner';
import { WalletIcon } from './icons/WalletIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ExclamationCircleIcon } from './icons/ExclamationCircleIcon';


interface StatusBarProps {
  sdkStatus: string;
  userAddress: string | null;
  isLoading: boolean;
  connectWallet: () => Promise<void>;
  currentChainName?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ sdkStatus, userAddress, isLoading, connectWallet, currentChainName }) => {
  const getStatusIndicator = () => {
    if (sdkStatus === 'Error' || sdkStatus === 'Error connecting wallet') {
      return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
    }
    if (sdkStatus === 'Ready' || sdkStatus.startsWith('Connected to')) {
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
    }
    return <Spinner size="sm" color="border-yellow-500" />;
  };
  
  return (
    <div className="mb-6 p-4 bg-neutral-800 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
      <div className="flex items-center space-x-2 text-sm">
        {getStatusIndicator()}
        <span className="text-neutral-300">
          Status: {sdkStatus} {currentChainName && `(${currentChainName})`}
        </span>
      </div>
      <div className="flex items-center space-x-3">
        {userAddress && (
          <div className="text-xs px-3 py-1.5 bg-neutral-700 rounded-full text-neutral-300 truncate max-w-[150px] sm:max-w-xs" title={userAddress}>
            <WalletIcon className="w-4 h-4 inline mr-1.5 text-yellow-500" />
            {`${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`}
          </div>
        )}
        {!userAddress && (
          <button
            onClick={connectWallet}
            disabled={isLoading}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-neutral-900 rounded-lg text-sm font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
          >
            {isLoading && sdkStatus.includes("wallet") ? <Spinner size="sm" color="border-neutral-900" /> : <WalletIcon className="w-5 h-5 mr-2" />}
            Connect Wallet
          </button>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
