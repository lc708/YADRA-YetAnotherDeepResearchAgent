'use client';

import React, { useState } from 'react';

interface ResumeControlProps {
  threadId: string;
  checkpointId?: string;
  onResume: (inputs?: Record<string, any>) => void;
  onFork: () => void;
  isLoading?: boolean;
}

export const ResumeControl: React.FC<ResumeControlProps> = ({
  threadId,
  checkpointId,
  onResume,
  onFork,
  isLoading = false,
}) => {
  const [showInputs, setShowInputs] = useState(false);
  const [additionalInputs, setAdditionalInputs] = useState('{}');
  const [inputError, setInputError] = useState('');

  const handleResume = () => {
    if (showInputs) {
      try {
        const inputs = JSON.parse(additionalInputs);
        onResume(inputs);
        setInputError('');
      } catch (e) {
        setInputError('Invalid JSON format');
      }
    } else {
      onResume();
    }
  };

  return (
    <div className="w-full p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Resume Control</h3>
      
      <div className="space-y-4">
        {/* Resume info */}
        <div className="text-sm text-gray-600">
          <p>Thread ID: <span className="font-mono">{threadId.slice(0, 8)}...</span></p>
          {checkpointId && (
            <p>Checkpoint: <span className="font-mono">{checkpointId.slice(0, 8)}...</span></p>
          )}
        </div>

        {/* Additional inputs toggle */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInputs}
              onChange={(e) => setShowInputs(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Add additional inputs
            </span>
          </label>
        </div>

        {/* Additional inputs editor */}
        {showInputs && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Inputs (JSON)
            </label>
            <div className="relative">
              <textarea
                value={additionalInputs}
                onChange={(e) => {
                  setAdditionalInputs(e.target.value);
                  setInputError('');
                }}
                className={`
                  w-full h-32 p-3 font-mono text-sm border rounded-lg
                  ${inputError ? 'border-red-300' : 'border-gray-300'}
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                `}
                placeholder='{"key": "value"}'
                spellCheck={false}
              />
              {inputError && (
                <p className="absolute -bottom-6 left-0 text-sm text-red-600">
                  {inputError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleResume}
            disabled={isLoading || !!inputError}
            className={`
              flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors
              ${isLoading || inputError
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-500 hover:bg-green-600'
              }
            `}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Resuming...
              </span>
            ) : (
              'Resume Execution'
            )}
          </button>
          
          <button
            onClick={onFork}
            disabled={isLoading}
            className={`
              px-4 py-2 text-sm font-medium border rounded-lg transition-colors
              ${isLoading
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }
            `}
          >
            Fork Thread
          </button>
        </div>

        {/* Resume options info */}
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Resume:</strong> Continue execution from this checkpoint
          </p>
          <p className="text-sm text-blue-800 mt-1">
            <strong>Fork:</strong> Create a new thread from this checkpoint
          </p>
        </div>
      </div>
    </div>
  );
}; 