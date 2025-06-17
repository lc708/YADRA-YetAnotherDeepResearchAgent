'use client';

import React from 'react';
import { useMultiTaskStore } from '../../store/multiTaskStore';
import { format } from 'date-fns';

export const MultiTaskSwitcher: React.FC = () => {
  const { activeTasks, currentTaskId, setCurrentTask, removeTask } = useMultiTaskStore();
  const tasks = Array.from(activeTasks.values());

  if (tasks.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No active tasks
      </div>
    );
  }

  return (
    <div className="w-full p-4">
      <h3 className="text-lg font-semibold mb-4">Active Tasks ({tasks.length})</h3>
      <div className="space-y-2">
        {tasks.map((task) => {
          const isActive = task.thread_id === currentTaskId;
          const statusColors = {
            running: 'bg-green-100 text-green-800',
            paused: 'bg-yellow-100 text-yellow-800',
            completed: 'bg-gray-100 text-gray-800',
            error: 'bg-red-100 text-red-800',
          };

          return (
            <div
              key={task.thread_id}
              className={`
                p-3 rounded-lg border cursor-pointer transition-all duration-200
                ${isActive 
                  ? 'bg-blue-50 border-blue-300 shadow-sm' 
                  : 'bg-white border-gray-200 hover:border-gray-300'
                }
              `}
              onClick={() => setCurrentTask(task.thread_id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{task.name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[task.status]}`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Thread: {task.thread_id.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-gray-500">
                    Updated: {format(new Date(task.updated_at), 'HH:mm:ss')}
                  </p>
                  {task.checkpoints.length > 0 && (
                    <p className="text-xs text-gray-600 mt-1">
                      {task.checkpoints.length} checkpoint{task.checkpoints.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                      Active
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTask(task.thread_id);
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove task"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Progress indicator for running tasks */}
              {task.status === 'running' && (
                <div className="mt-2">
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}; 