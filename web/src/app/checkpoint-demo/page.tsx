'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CheckpointPanel } from '../../components/checkpoint/CheckpointPanel';
import { useMultiTaskStore } from '../../store/multiTaskStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function DemoContent() {
  const { addTask } = useMultiTaskStore();
  const [threadId, setThreadId] = useState('');
  
  const createDemoTasks = () => {
    // Create demo tasks
    const demoTasks = [
      {
        thread_id: 'demo-task-001',
        name: '量子计算研究',
        status: 'running' as const,
        checkpoints: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        thread_id: 'demo-task-002',
        name: 'AI伦理探讨',
        status: 'paused' as const,
        checkpoints: [],
        created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        thread_id: 'demo-task-003',
        name: '区块链分析',
        status: 'completed' as const,
        checkpoints: [],
        created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    
    demoTasks.forEach(task => addTask(task));
    alert('Demo tasks created! Click on a task to view details.');
  };
  
  const addRealTask = () => {
    if (!threadId.trim()) {
      alert('Please enter a thread ID');
      return;
    }
    
    addTask({
      thread_id: threadId.trim(),
      name: `Task ${threadId.slice(0, 8)}...`,
      status: 'running',
      checkpoints: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    setThreadId('');
    alert(`Task ${threadId} added! Click on it to view details.`);
  };
  
  // Add known running tasks from logs
  const addKnownTasks = () => {
    const knownTasks = [
      { id: '8mQw-VJTocYuCC9EGJehF', name: '量子计算如何影响密码学' },
      { id: 'NiRTqfaCeklSyg2KqdS7s', name: '可再生能源技术的最新发展' },
    ];
    
    knownTasks.forEach(task => {
      addTask({
        thread_id: task.id,
        name: task.name,
        status: 'running',
        checkpoints: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
    
    alert('Known tasks added! Click on a task to view its checkpoints.');
  };
  
  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Checkpoint Management Demo</h1>
            <p className="text-sm text-gray-600 mt-1">
              Test checkpoint features: pause/resume, multi-task management, and state editing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              placeholder="Enter thread ID"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={addRealTask}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Add Task
            </button>
            <button
              onClick={addKnownTasks}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Add Known Tasks
            </button>
            <button
              onClick={createDemoTasks}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Create Demo Tasks
            </button>
          </div>
        </div>
      </header>
      
      <main className="flex-1 overflow-hidden">
        <CheckpointPanel />
      </main>
    </div>
  );
}

export default function CheckpointDemoPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <DemoContent />
    </QueryClientProvider>
  );
} 