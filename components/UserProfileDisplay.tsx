import React from 'react';
import { UserProfile } from '../types';
import { StarIcon } from './icons/StarIcon'; // Using StarIcon for points for now
import { FireIcon } from './icons/FireIcon';
import { UserCircleIcon } from './icons/UserCircleIcon';

interface UserProfileDisplayProps {
  profile: UserProfile | null;
  isLoading: boolean;
}

const UserProfileDisplay: React.FC<UserProfileDisplayProps> = ({ profile, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-4 bg-neutral-800 rounded-lg shadow-md animate-pulse h-24 flex items-center justify-center">
        <p className="text-neutral-400">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
       <div className="p-4 bg-neutral-800 rounded-lg shadow-md text-center">
        <p className="text-neutral-400 text-sm">Connect wallet to see your profile and points.</p>
      </div>
    );
  }
  
  const displayName = profile.username || `${profile.address.substring(0, 6)}...${profile.address.substring(profile.address.length - 4)}`;

  return (
    <div className="p-4 bg-neutral-800 rounded-lg shadow-xl border border-neutral-700">
      <div className="flex items-center mb-3">
        <UserCircleIcon className="w-10 h-10 text-yellow-500 mr-3"/>
        <div>
            <h3 className="text-lg font-semibold text-neutral-100" title={profile.address}>{displayName}</h3>
            <p className="text-xs text-neutral-400">Community Contributor</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center p-3 bg-neutral-700 rounded-md">
          <StarIcon className="w-6 h-6 text-yellow-500 mr-2.5" />
          <div>
            <span className="text-xl font-bold text-neutral-100">{profile.points}</span>
            <p className="text-xs text-neutral-400">Points</p>
          </div>
        </div>
        <div className="flex items-center p-3 bg-neutral-700 rounded-md">
          <FireIcon className="w-6 h-6 text-orange-500 mr-2.5" />
           <div>
            <span className="text-xl font-bold text-neutral-100">{profile.reviewStreak}</span>
            <p className="text-xs text-neutral-400">Day Streak</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileDisplay;