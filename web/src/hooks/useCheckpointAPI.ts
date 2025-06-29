import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { CheckpointInfo, ThreadState } from '../store/multiTaskStore';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface StateUpdate {
  updates: Record<string, any>;
  metadata?: Record<string, any>;
}

interface ResumeRequest {
  checkpoint_id?: string;
  inputs?: Record<string, any>;
}

// Fetch checkpoints for a thread
export const useCheckpoints = (threadId: string, enabled = true) => {
  return useQuery<CheckpointInfo[]>({
    queryKey: ['checkpoints', threadId],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/threads/${threadId}/checkpoints`);
      if (!response.ok) throw new Error('Failed to fetch checkpoints');
      return response.json();
    },
    enabled: enabled && !!threadId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
  });
};

// Fetch thread state
export const useThreadState = (threadId: string, checkpointId?: string, enabled = true) => {
  return useQuery<ThreadState>({
    queryKey: ['thread-state', threadId, checkpointId],
    queryFn: async () => {
      const url = new URL(`${API_BASE_URL}/threads/${threadId}/state`);
      if (checkpointId) {
        url.searchParams.append('checkpoint_id', checkpointId);
      }
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Failed to fetch thread state');
      return response.json();
    },
    enabled: enabled && !!threadId,
  });
};

// Update thread state
export const useUpdateThreadState = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ threadId, updates }: { threadId: string; updates: StateUpdate }) => {
      const response = await fetch(`${API_BASE_URL}/threads/${threadId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update thread state');
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['thread-state', variables.threadId] });
      queryClient.invalidateQueries({ queryKey: ['checkpoints', variables.threadId] });
    },
  });
};

// Resume thread execution
export const useResumeThread = () => {
  return useMutation({
    mutationFn: async ({ threadId, request }: { threadId: string; request: ResumeRequest }) => {
      const response = await fetch(`${API_BASE_URL}/threads/${threadId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error('Failed to resume thread');
      
      // Return the response for streaming
      return response;
    },
  });
};

// Fork thread
export const useForkThread = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      threadId, 
      checkpointId, 
      newThreadId 
    }: { 
      threadId: string; 
      checkpointId?: string; 
      newThreadId?: string;
    }) => {
      const response = await fetch(`${API_BASE_URL}/threads/${threadId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint_id: checkpointId, new_thread_id: newThreadId }),
      });
      if (!response.ok) throw new Error('Failed to fork thread');
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate queries for the new thread
      queryClient.invalidateQueries({ queryKey: ['thread-state', data.thread_id] });
    },
  });
};

// Hook to handle SSE streaming from resume endpoint
export const useResumeStreamHandler = (
  onStateUpdate: (data: any) => void,
  onComplete: (threadId: string) => void,
  onError: (error: string) => void
) => {
  const handleStream = async (response: Response) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) {
      onError('No response body');
      return;
    }
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'state_update':
                onStateUpdate(data.data);
                break;
              case 'complete':
                onComplete(data.thread_id);
                break;
              case 'error':
                onError(data.error);
                break;
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Stream processing error');
    } finally {
      reader.releaseLock();
    }
  };
  
  return { handleStream };
}; 