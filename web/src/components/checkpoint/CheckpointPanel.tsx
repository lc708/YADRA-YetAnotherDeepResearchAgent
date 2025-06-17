'use client';

import React, { useState, useEffect } from 'react';
import { useMultiTaskStore } from '../../store/multiTaskStore';
import { 
  useCheckpoints, 
  useThreadState, 
  useUpdateThreadState, 
  useResumeThread,
  useForkThread,
  useResumeStreamHandler
} from '../../hooks/useCheckpointAPI';
import { CheckpointTimeline } from './CheckpointTimeline';
import { StateEditor } from './StateEditor';
import { ResumeControl } from './ResumeControl';
import { MultiTaskSwitcher } from './MultiTaskSwitcher';

export const CheckpointPanel: React.FC = () => {
  const { currentTaskId, updateTaskCheckpoints, updateTaskState, updateTaskStatus, addTask, activeTasks } = useMultiTaskStore();
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | undefined>();
  const [showStateEditor, setShowStateEditor] = useState(false);
  const [showResumeControl, setShowResumeControl] = useState(false);

  // Auto-discover running tasks from workspace
  useEffect(() => {
    // Check if we're on a workspace page and extract thread ID
    const urlParams = new URLSearchParams(window.location.search);
    const workspacePath = window.location.pathname;
    
    // Extract thread ID from URL if available
    const threadIdMatch = workspacePath.match(/\/workspace\/([^?]+)/);
    if (threadIdMatch && threadIdMatch[1]) {
      const threadId = threadIdMatch[1];
      
      // Check if this task is already in our store
      if (!activeTasks.has(threadId)) {
        // Add it as a new task
        addTask({
          thread_id: threadId,
          name: `Task ${threadId.slice(0, 8)}...`,
          status: 'running',
          checkpoints: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
  }, [activeTasks, addTask]); // Add dependencies

  // Fetch checkpoints for current task
  const { data: checkpoints, isLoading: checkpointsLoading } = useCheckpoints(
    currentTaskId || '', 
    !!currentTaskId
  );

  // Fetch thread state for selected checkpoint
  const { data: threadState, isLoading: stateLoading } = useThreadState(
    currentTaskId || '',
    selectedCheckpointId,
    !!currentTaskId
  );

  // Mutations
  const updateStateMutation = useUpdateThreadState();
  const resumeThreadMutation = useResumeThread();
  const forkThreadMutation = useForkThread();

  // Stream handler for resume
  const { handleStream } = useResumeStreamHandler(
    (data) => {
      // Handle state updates during resume
      console.log('State update:', data);
    },
    (threadId) => {
      // Handle completion
      updateTaskStatus(threadId, 'completed');
    },
    (error) => {
      // Handle error
      console.error('Resume error:', error);
      if (currentTaskId) {
        updateTaskStatus(currentTaskId, 'error');
      }
    }
  );

  // Update task checkpoints when data changes
  useEffect(() => {
    if (currentTaskId && checkpoints) {
      updateTaskCheckpoints(currentTaskId, checkpoints);
    }
  }, [currentTaskId, checkpoints, updateTaskCheckpoints]);

  // Update task state when thread state changes
  useEffect(() => {
    if (currentTaskId && threadState) {
      updateTaskState(currentTaskId, threadState);
    }
  }, [currentTaskId, threadState, updateTaskState]);

  const handleCheckpointSelect = (checkpointId: string) => {
    setSelectedCheckpointId(checkpointId);
    setShowStateEditor(false);
    setShowResumeControl(false);
  };

  const handleStateUpdate = async (updates: Record<string, any>) => {
    if (!currentTaskId) return;
    
    try {
      await updateStateMutation.mutateAsync({
        threadId: currentTaskId,
        updates: { updates }
      });
      setShowStateEditor(false);
    } catch (error) {
      console.error('Failed to update state:', error);
    }
  };

  const handleResume = async (inputs?: Record<string, any>) => {
    if (!currentTaskId) return;
    
    try {
      updateTaskStatus(currentTaskId, 'running');
      const response = await resumeThreadMutation.mutateAsync({
        threadId: currentTaskId,
        request: {
          checkpoint_id: selectedCheckpointId,
          inputs
        }
      });
      
      // Handle the streaming response
      await handleStream(response);
    } catch (error) {
      console.error('Failed to resume thread:', error);
      updateTaskStatus(currentTaskId, 'error');
    }
  };

  const handleFork = async () => {
    if (!currentTaskId) return;
    
    try {
      const result = await forkThreadMutation.mutateAsync({
        threadId: currentTaskId,
        checkpointId: selectedCheckpointId
      });
      
      // Add the forked thread as a new task
      addTask({
        thread_id: result.thread_id,
        name: `Fork of ${currentTaskId.slice(0, 8)}`,
        status: 'paused',
        checkpoints: [],
        state: result,
        created_at: result.created_at,
        updated_at: new Date().toISOString()
      });
      
      setShowResumeControl(false);
    } catch (error) {
      console.error('Failed to fork thread:', error);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left sidebar - Task switcher */}
      <div className="w-80 border-r border-gray-200 overflow-y-auto">
        <MultiTaskSwitcher />
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Checkpoint timeline */}
        <div className="w-96 border-r border-gray-200 overflow-y-auto">
          {currentTaskId ? (
            checkpointsLoading ? (
              <div className="p-4 text-center text-gray-500">Loading checkpoints...</div>
            ) : checkpoints && checkpoints.length > 0 ? (
              <CheckpointTimeline
                checkpoints={checkpoints}
                currentCheckpointId={selectedCheckpointId}
                onCheckpointSelect={handleCheckpointSelect}
              />
            ) : (
              <div className="p-4 text-center text-gray-500">No checkpoints yet</div>
            )
          ) : (
            <div className="p-4 text-center text-gray-500">Select a task to view checkpoints</div>
          )}
        </div>

        {/* Right panel - State editor or Resume control */}
        <div className="flex-1 overflow-y-auto">
          {currentTaskId && threadState ? (
            <div className="h-full">
              {/* Action buttons */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowStateEditor(true);
                      setShowResumeControl(false);
                    }}
                    className={`
                      px-4 py-2 text-sm font-medium rounded-lg transition-colors
                      ${showStateEditor 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    Edit State
                  </button>
                  <button
                    onClick={() => {
                      setShowResumeControl(true);
                      setShowStateEditor(false);
                    }}
                    className={`
                      px-4 py-2 text-sm font-medium rounded-lg transition-colors
                      ${showResumeControl 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    Resume/Fork
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                {showStateEditor ? (
                  <StateEditor
                    threadState={threadState}
                    onSave={handleStateUpdate}
                    onCancel={() => setShowStateEditor(false)}
                  />
                ) : showResumeControl ? (
                  <ResumeControl
                    threadId={currentTaskId}
                    checkpointId={selectedCheckpointId}
                    onResume={handleResume}
                    onFork={handleFork}
                    isLoading={resumeThreadMutation.isPending}
                  />
                ) : (
                  <StateEditor
                    threadState={threadState}
                    onSave={() => {}}
                    onCancel={() => {}}
                    readOnly={true}
                  />
                )}
              </div>
            </div>
          ) : currentTaskId ? (
            <div className="p-4 text-center text-gray-500">
              {stateLoading ? 'Loading state...' : 'Select a checkpoint to view details'}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              Select a task and checkpoint to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 