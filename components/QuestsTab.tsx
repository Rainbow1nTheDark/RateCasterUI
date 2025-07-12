
import React, { useEffect, useState } from 'react';
import { TaskDefinition, UserTaskProgressEntry, UserProfile } from '../types';
import Spinner from './Spinner';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { QuestsIcon } from './icons/QuestsIcon';

const API_BASE_URL = 'https://app.ratecaster.xyz/api';

interface QuestsTabProps {
  userAddress: string | null;
}

const QuestsTab: React.FC<QuestsTabProps> = ({ userAddress }) => {
  const [activeTasks, setActiveTasks] = useState<TaskDefinition[]>([]);
  const [userProgress, setUserProgress] = useState<UserTaskProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasksAndProgress = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const tasksRes = await fetch(`${API_BASE_URL}/tasks/active`);
        if (!tasksRes.ok) throw new Error('Failed to fetch tasks definitions.');
        const tasksData: TaskDefinition[] = await tasksRes.json();
        setActiveTasks(tasksData);

        if (userAddress) {
          const progressRes = await fetch(`${API_BASE_URL}/tasks/progress?userAddress=${userAddress}`);
          if (!progressRes.ok) throw new Error('Failed to fetch user task progress.');
          const progressData: UserTaskProgressEntry[] = await progressRes.json();
          setUserProgress(progressData);
        } else {
          setUserProgress([]); // Clear progress if no user address
        }
      } catch (err: any) {
        setError(err.message);
        console.error("Error fetching quests data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasksAndProgress();
    // Re-fetch progress when userAddress changes
  }, [userAddress]);


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-6">
        <Spinner size="lg" />
        <p className="mt-4 text-neutral-400">Loading Quests...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center p-6">{error}</p>;
  }

  const getTaskProgress = (taskId: string): UserTaskProgressEntry | undefined => {
    return userProgress.find(p => p.taskId === taskId);
  };

  const dailyTasks = activeTasks.filter(t => t.cadence === 'DAILY');
  // const weeklyTasks = activeTasks.filter(t => t.cadence === 'WEEKLY'); // For future

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 bg-neutral-800/50 rounded-xl shadow-xl">
      <div className="flex items-center justify-center mb-6">
        <QuestsIcon className="w-10 h-10 text-yellow-500 mr-3"/>
        <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-100">Daily Quests</h2>
      </div>

      {!userAddress && (
        <p className="text-center text-neutral-400 py-6">
          Please connect your wallet to see and track your quests.
        </p>
      )}

      {userAddress && dailyTasks.length === 0 && (
        <p className="text-center text-neutral-400 py-6">No daily quests available at the moment. Check back later!</p>
      )}
      
      {userAddress && dailyTasks.length > 0 && (
        <div className="space-y-4">
          {dailyTasks.map(task => {
            const progress = getTaskProgress(task.taskId);
            const isCompleted = progress?.isCompletedThisPeriod || false;
            // const currentCount = progress?.currentCount || 0;

            return (
              <div key={task.taskId} className={`p-4 rounded-lg border ${isCompleted ? 'bg-green-800/30 border-green-700' : 'bg-neutral-700/60 border-neutral-600'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`text-lg font-semibold ${isCompleted ? 'text-green-400' : 'text-yellow-400'}`}>{task.title}</h3>
                    <p className="text-sm text-neutral-300 mt-1">{task.description}</p>
                    <p className="text-xs text-yellow-500 mt-1">Reward: {task.pointsReward} Points</p>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    {isCompleted ? (
                      <div className="flex items-center text-green-400">
                        <CheckCircleIcon className="w-6 h-6 mr-1" />
                        <span className="text-sm font-medium">Completed!</span>
                      </div>
                    ) : (
                       <span className="px-3 py-1 text-xs font-medium bg-neutral-600 text-neutral-300 rounded-full">To Do</span>
                    )}
                  </div>
                </div>
                {/* 
                // Optional: Progress bar if targetCount > 1
                {task.targetCount > 1 && !isCompleted && (
                  <div className="mt-2">
                    <div className="w-full bg-neutral-600 rounded-full h-2.5">
                      <div className="bg-yellow-500 h-2.5 rounded-full" style={{ width: `${(currentCount / task.targetCount) * 100}%` }}></div>
                    </div>
                    <p className="text-xs text-neutral-400 text-right mt-1">{currentCount} / {task.targetCount}</p>
                  </div>
                )}
                */}
                 {task.actionUrl && !isCompleted && (
                  <a 
                    href={task.actionUrl}
                    onClick={(e) => {
                        // If it's an internal link, use setActiveTab or similar if needed
                        if (task.actionUrl?.startsWith('/#')) {
                            // Example: navigate to a tab or section
                            // This part would need more robust routing or tab switching logic from App.tsx
                            const targetTab = task.actionUrl.substring(2);
                            // TODO: Implement navigation if possible or just let it be a standard link
                            console.log("Navigate to:", targetTab);
                        }
                    }}
                    className="inline-block mt-3 px-4 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-neutral-900 text-sm font-medium rounded-md transition-colors"
                  >
                    {task.actionUrlText || 'Go to Task'}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* Placeholder for Weekly Quests
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-neutral-100 mb-4 text-center border-t border-neutral-700 pt-6">Weekly Quests</h2>
        <p className="text-center text-neutral-500">Weekly quests coming soon!</p>
      </div>
      */}
    </div>
  );
};

export default QuestsTab;
