'use client';

import React from 'react';
import { format } from 'date-fns';
import type { CheckpointInfo } from '../../store/multiTaskStore';

interface CheckpointTimelineProps {
  checkpoints: CheckpointInfo[];
  currentCheckpointId?: string;
  onCheckpointSelect: (checkpointId: string) => void;
}

export const CheckpointTimeline: React.FC<CheckpointTimelineProps> = ({
  checkpoints,
  currentCheckpointId,
  onCheckpointSelect,
}) => {
  return (
    <div className="w-full p-4">
      <h3 className="text-lg font-semibold mb-4">Checkpoint History</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>
        
        {/* Checkpoints */}
        <div className="space-y-4">
          {checkpoints.map((checkpoint, index) => {
            const isActive = checkpoint.checkpoint_id === currentCheckpointId;
            const timestamp = new Date(checkpoint.timestamp);
            
            return (
              <div
                key={checkpoint.checkpoint_id}
                className="relative flex items-start cursor-pointer group"
                onClick={() => onCheckpointSelect(checkpoint.checkpoint_id)}
              >
                {/* Dot */}
                <div
                  className={`
                    absolute left-2 w-4 h-4 rounded-full border-2 
                    ${isActive 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'bg-white border-gray-400 group-hover:border-blue-400'
                    }
                    transition-colors duration-200
                  `}
                ></div>
                
                {/* Content */}
                <div className="ml-10 flex-1">
                  <div
                    className={`
                      p-3 rounded-lg border
                      ${isActive 
                        ? 'bg-blue-50 border-blue-300' 
                        : 'bg-white border-gray-200 hover:border-gray-300'
                      }
                      transition-all duration-200
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Checkpoint #{checkpoints.length - index}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {format(timestamp, 'MMM d, yyyy HH:mm:ss')}
                        </p>
                      </div>
                      {isActive && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                          Current
                        </span>
                      )}
                    </div>
                    
                    {/* Metadata preview */}
                    {checkpoint.metadata && Object.keys(checkpoint.metadata).length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <p className="font-medium">Metadata:</p>
                        <div className="mt-1 space-y-0.5">
                          {Object.entries(checkpoint.metadata).slice(0, 3).map(([key, value]) => (
                            <p key={key} className="truncate">
                              {key}: {JSON.stringify(value)}
                            </p>
                          ))}
                          {Object.keys(checkpoint.metadata).length > 3 && (
                            <p className="text-gray-400">
                              +{Object.keys(checkpoint.metadata).length - 3} more...
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}; 