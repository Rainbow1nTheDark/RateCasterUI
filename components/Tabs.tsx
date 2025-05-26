import React from 'react';
import { EyeIcon } from './icons/EyeIcon';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { ChatBubbleLeftRightIcon } from './icons/ChatBubbleLeftRightIcon';
import { TrophyIcon } from './icons/TrophyIcon'; // New Icon

export type ActiveTab = 'browse' | 'add' | 'edit' | 'reviews' | 'leaderboard'; // Added 'leaderboard'

interface TabsProps {
  activeTab: ActiveTab;
  isLoading: boolean;
  setActiveTab: (tab: ActiveTab) => void;
}

const Tabs: React.FC<TabsProps> = ({ activeTab, isLoading, setActiveTab }) => {
  const tabsConfig: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'browse', label: 'Browse Dapps', icon: <EyeIcon className="w-5 h-5 mr-2"/> },
    { id: 'add', label: 'Add Dapp', icon: <PlusCircleIcon className="w-5 h-5 mr-2"/> },
    { id: 'reviews', label: 'My Reviews', icon: <ChatBubbleLeftRightIcon className="w-5 h-5 mr-2"/> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <TrophyIcon className="w-5 h-5 mr-2"/> }, // New Tab
  ];

  return (
    <div className="mb-8 flex flex-wrap justify-center gap-2 sm:gap-4 border-b border-neutral-700 pb-3">
      {tabsConfig.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            if (tab.id !== 'edit') setActiveTab(tab.id)
          }}
          disabled={isLoading || tab.id === 'edit'} // 'edit' tab is programmatic
          className={`px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium flex items-center transition-all duration-150
            ${activeTab === tab.id 
              ? 'bg-yellow-500 text-neutral-900 shadow-md' 
              : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600 hover:text-neutral-100'}
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
            ${tab.id === 'edit' && activeTab !== 'edit' ? 'hidden' : ''} 
            ${tab.id === 'edit' && activeTab === 'edit' ? '!bg-yellow-600 !text-neutral-900' : ''} 
          `}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          {tab.icon}
          {tab.label}
          {tab.id === 'edit' && activeTab === 'edit' && ' (Editing)'}
        </button>
      ))}
    </div>
  );
};

export default Tabs;