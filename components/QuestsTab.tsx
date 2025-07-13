
import React, { useEffect, useState } from 'react';
import { TaskDefinition, UserTaskProgressEntry } from '../types';
import Spinner from './Spinner';
import { QuestsIcon } from './icons/QuestsIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

const API_BASE_URL = 'http://app.ratecaster.xyz/api';

interface QuestsTabProps {
  userAddress: string | null;
}

interface MergedTask extends TaskDefinition {
  progress: UserTaskProgressEntry;
}

const QuestsTab: React.FC<QuestsTabProps> = ({ userAddress }) => {
  const [tasks, setTasks] = useState<MergedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress) {
      setIsLoading(false);
      return;
    }

    const fetchQuestsData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [tasksRes, progressRes] = await Promise.all([
          fetch(`${API_BASE_URL}/tasks/active`),
          fetch(`${API_BASE_URL}/tasks/progress?userAddress=${userAddress}`),
        ]);

        if (!tasksRes.ok) throw new Error('Failed to fetch tasks');
        if (!progressRes.ok) throw new Error('Failed to fetch user progress');

        const tasksData: TaskDefinition[] = await tasksRes.json();
        const progressData: UserTaskProgressEntry[] = await progressRes.json();

        const progressMap = new Map(progressData.map(p => [p.taskId, p]));

        const mergedTasks = tasksData.map(task => ({
          ...task,
          progress: progressMap.get(task.taskId) || {
            taskId: task.taskId,
            currentCount: 0,
            lastProgressTimestamp: 0,
            isCompletedThisPeriod: false,
          },
        }));

        setTasks(mergedTasks);
      } catch (err: any) {
        setError(err.message || 'Could not load quests.');
        console.error('Quests fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestsData();
  }, [userAddress]);

  if (!userAddress) {
    return (
      <div className="text-center p-10 bg-neutral-800 rounded-lg">
        <p className="text-neutral-400">Please connect your wallet to view and complete quests.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner size="lg" />
        <p className="mt-4 text-neutral-400">Loading Quests...</p>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-center p-6">{error}</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 bg-neutral-800/50 rounded-xl shadow-xl">
      <div className="flex items-center justify-center mb-6">
        <QuestsIcon className="w-10 h-10 text-yellow-500 mr-3" />
        <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-100">Daily Quests</h2>
      </div>
      {tasks.length > 0 ? (
        <ul className="space-y-4">
          {tasks.map(task => (
            <li key={task.taskId} className={`p-4 rounded-lg transition-all duration-300 ${task.progress.isCompletedThisPeriod ? 'bg-green-500/10 border-l-4 border-green-500' : 'bg-neutral-700/60 hover:bg-neutral-700'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg text-neutral-100">{task.title}</h3>
                  <p className="text-sm text-neutral-400 mt-1">{task.description}</p>
                  <p className="text-xs text-yellow-400 mt-2">Reward: {task.pointsReward} Points</p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  {task.progress.isCompletedThisPeriod ? (
                    <div className="flex items-center gap-2 text-green-400 font-semibold">
                      <CheckCircleIcon className="w-6 h-6" />
                      <span>Completed</span>
                    </div>
                  ) : (
                    <div className="font-semibold text-neutral-300">
                      {task.progress.currentCount} / {task.targetCount}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-neutral-400 text-center py-8">No active quests at the moment. Check back soon!</p>
      )}
    </div>
  );
};

export default QuestsTab;
