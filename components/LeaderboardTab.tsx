import React, { useEffect, useState } from 'react';
import { LeaderboardEntry, UserProfile } from '../types';
import Spinner from './Spinner';
import { TrophyIcon } from './icons/TrophyIcon';
import { FireIcon } from './icons/FireIcon';
import { StarIcon } from './icons/StarIcon'; // For points
import { UserCircleIcon } from './icons/UserCircleIcon';

const API_BASE_URL = 'https://app.ratecaster.xyz/api'; // Adjust if your backend URL is different

const LeaderboardTab: React.FC = () => {
  const [topReviewers, setTopReviewers] = useState<LeaderboardEntry[]>([]);
  const [topStreaks, setTopStreaks] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBoard, setActiveBoard] = useState<'reviewers' | 'streaks'>('reviewers');

  useEffect(() => {
    const fetchLeaderboards = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [reviewersRes, streaksRes] = await Promise.all([
          fetch(`${API_BASE_URL}/leaderboard/top-reviewers`),
          fetch(`${API_BASE_URL}/leaderboard/top-streaks`),
        ]);

        if (!reviewersRes.ok) throw new Error(`Failed to fetch top reviewers: ${reviewersRes.statusText}`);
        if (!streaksRes.ok) throw new Error(`Failed to fetch top streaks: ${streaksRes.statusText}`);
        
        const reviewersData = await reviewersRes.json();
        const streaksData = await streaksRes.json();
        
        setTopReviewers(reviewersData);
        setTopStreaks(streaksData);

      } catch (err: any) {
        setError(err.message || 'Could not load leaderboards.');
        console.error("Leaderboard fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboards();
  }, []);

  const renderLeaderboardList = (items: LeaderboardEntry[], type: 'points' | 'streak') => {
    if (items.length === 0) {
      return <p className="text-neutral-400 text-center py-8">No data available for this leaderboard yet.</p>;
    }

    return (
      <ul className="space-y-3">
        {items.map((entry, index) => (
          <li 
            key={entry.address} 
            className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${index < 3 ? 'bg-neutral-700 border-l-4 ' + (index === 0 ? 'border-yellow-400' : index === 1 ? 'border-neutral-400' : 'border-orange-600') : 'bg-neutral-800 hover:bg-neutral-700/70'}`}
          >
            <div className="flex items-center">
              <span className={`mr-3 font-semibold text-sm w-6 text-center ${index < 3 ? 'text-yellow-300' : 'text-neutral-500'}`}>#{entry.rank}</span>
              <UserCircleIcon className="w-8 h-8 text-neutral-500 mr-3"/>
              <div>
                <p className="text-sm font-medium text-neutral-100 truncate max-w-[120px] sm:max-w-[200px]" title={entry.address}>
                  {entry.username || `${entry.address.substring(0, 6)}...${entry.address.substring(entry.address.length - 4)}`}
                </p>
                {type === 'points' && <p className="text-xs text-neutral-400">{entry.points} Points</p>}
                {type === 'streak' && <p className="text-xs text-neutral-400">{entry.reviewStreak} Day Streak</p>}
              </div>
            </div>
            {type === 'points' && <StarIcon className="w-5 h-5 text-yellow-500" />}
            {type === 'streak' && <FireIcon className="w-5 h-5 text-orange-500" />}
          </li>
        ))}
      </ul>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-6">
        <Spinner size="lg" />
        <p className="mt-4 text-neutral-400">Loading Leaderboards...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center p-6">{error}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 bg-neutral-800/50 rounded-xl shadow-xl">
      <div className="flex items-center justify-center mb-6">
        <TrophyIcon className="w-10 h-10 text-yellow-500 mr-3"/>
        <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-100">Leaderboards</h2>
      </div>

      <div className="flex justify-center mb-6 space-x-2 border-b border-neutral-700 pb-2">
        <button 
          onClick={() => setActiveBoard('reviewers')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeBoard === 'reviewers' ? 'bg-yellow-500 text-neutral-900' : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'}`}
        >
          Top Reviewers (Points)
        </button>
        <button 
          onClick={() => setActiveBoard('streaks')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeBoard === 'streaks' ? 'bg-yellow-500 text-neutral-900' : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'}`}
        >
          Top Streaks
        </button>
      </div>

      {activeBoard === 'reviewers' && (
        <div>
          <h3 className="text-xl font-medium text-yellow-400 mb-4 text-center">Top Reviewers by Points</h3>
          {renderLeaderboardList(topReviewers, 'points')}
        </div>
      )}

      {activeBoard === 'streaks' && (
        <div>
          <h3 className="text-xl font-medium text-orange-400 mb-4 text-center">Top Review Streaks</h3>
          {renderLeaderboardList(topStreaks, 'streak')}
        </div>
      )}
    </div>
  );
};

export default LeaderboardTab;
