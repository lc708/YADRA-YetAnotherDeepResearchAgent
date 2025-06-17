'use client';

import React, { useState, useEffect } from 'react';
import type { ThreadState } from '../../store/multiTaskStore';

interface StateEditorProps {
  threadState: ThreadState;
  onSave: (updates: Record<string, any>) => void;
  onCancel: () => void;
  readOnly?: boolean;
}

export const StateEditor: React.FC<StateEditorProps> = ({
  threadState,
  onSave,
  onCancel,
  readOnly = false,
}) => {
  const [editedState, setEditedState] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Initialize with formatted JSON
    setEditedState(JSON.stringify(threadState.state, null, 2));
    setError('');
  }, [threadState]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editedState);
      onSave(parsed);
      setError('');
    } catch (e) {
      setError('Invalid JSON format');
    }
  };

  const handleReset = () => {
    setEditedState(JSON.stringify(threadState.state, null, 2));
    setError('');
  };

  return (
    <div className="w-full p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">State Editor</h3>
        <p className="text-sm text-gray-600 mt-1">
          Thread: {threadState.thread_id} | Checkpoint: {threadState.checkpoint_id.slice(0, 8)}...
        </p>
      </div>

      {/* State editor */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current State
          </label>
          <div className="relative">
            <textarea
              value={editedState}
              onChange={(e) => {
                setEditedState(e.target.value);
                setError('');
              }}
              readOnly={readOnly}
              className={`
                w-full h-96 p-3 font-mono text-sm border rounded-lg
                ${error ? 'border-red-300' : 'border-gray-300'}
                ${readOnly ? 'bg-gray-50' : 'bg-white'}
                focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
              spellCheck={false}
            />
            {error && (
              <p className="absolute -bottom-6 left-0 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Metadata display */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Metadata
          </label>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <pre className="text-xs text-gray-600 overflow-x-auto">
              {JSON.stringify(threadState.metadata, null, 2)}
            </pre>
          </div>
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex justify-end gap-2 pt-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!!error}
              className={`
                px-4 py-2 text-sm text-white rounded-lg transition-colors
                ${error 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600'
                }
              `}
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}; 