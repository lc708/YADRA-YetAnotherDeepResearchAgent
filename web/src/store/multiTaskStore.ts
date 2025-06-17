import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface CheckpointInfo {
  checkpoint_id: string;
  thread_id: string;
  timestamp: string;
  metadata: Record<string, any>;
  parent_checkpoint_id?: string;
}

export interface ThreadState {
  thread_id: string;
  checkpoint_id: string;
  state: Record<string, any>;
  metadata: Record<string, any>;
  created_at: string;
  parent_checkpoint_id?: string;
}

export interface TaskState {
  thread_id: string;
  name: string;
  status: 'running' | 'paused' | 'completed' | 'error';
  current_checkpoint?: string;
  checkpoints: CheckpointInfo[];
  state?: ThreadState;
  created_at: string;
  updated_at: string;
}

interface MultiTaskState {
  // Task management
  activeTasks: Map<string, TaskState>;
  currentTaskId: string | null;
  
  // Actions
  addTask: (task: TaskState) => void;
  removeTask: (taskId: string) => void;
  setCurrentTask: (taskId: string | null) => void;
  updateTaskStatus: (taskId: string, status: TaskState['status']) => void;
  updateTaskCheckpoints: (taskId: string, checkpoints: CheckpointInfo[]) => void;
  updateTaskState: (taskId: string, state: ThreadState) => void;
  
  // Checkpoint actions
  addCheckpoint: (taskId: string, checkpoint: CheckpointInfo) => void;
  setCurrentCheckpoint: (taskId: string, checkpointId: string) => void;
  
  // Utility
  getTask: (taskId: string) => TaskState | undefined;
  getAllTasks: () => TaskState[];
}

export const useMultiTaskStore = create<MultiTaskState>()(
  devtools(
    (set, get) => ({
      activeTasks: new Map(),
      currentTaskId: null,
      
      addTask: (task) => set((state) => {
        const newTasks = new Map(state.activeTasks);
        newTasks.set(task.thread_id, task);
        return { activeTasks: newTasks };
      }),
      
      removeTask: (taskId) => set((state) => {
        const newTasks = new Map(state.activeTasks);
        newTasks.delete(taskId);
        return { 
          activeTasks: newTasks,
          currentTaskId: state.currentTaskId === taskId ? null : state.currentTaskId
        };
      }),
      
      setCurrentTask: (taskId) => set({ currentTaskId: taskId }),
      
      updateTaskStatus: (taskId, status) => set((state) => {
        const task = state.activeTasks.get(taskId);
        if (!task) return state;
        
        const newTasks = new Map(state.activeTasks);
        newTasks.set(taskId, {
          ...task,
          status,
          updated_at: new Date().toISOString()
        });
        return { activeTasks: newTasks };
      }),
      
      updateTaskCheckpoints: (taskId, checkpoints) => set((state) => {
        const task = state.activeTasks.get(taskId);
        if (!task) return state;
        
        const newTasks = new Map(state.activeTasks);
        newTasks.set(taskId, {
          ...task,
          checkpoints,
          updated_at: new Date().toISOString()
        });
        return { activeTasks: newTasks };
      }),
      
      updateTaskState: (taskId, threadState) => set((state) => {
        const task = state.activeTasks.get(taskId);
        if (!task) return state;
        
        const newTasks = new Map(state.activeTasks);
        newTasks.set(taskId, {
          ...task,
          state: threadState,
          current_checkpoint: threadState.checkpoint_id,
          updated_at: new Date().toISOString()
        });
        return { activeTasks: newTasks };
      }),
      
      addCheckpoint: (taskId, checkpoint) => set((state) => {
        const task = state.activeTasks.get(taskId);
        if (!task) return state;
        
        const newTasks = new Map(state.activeTasks);
        newTasks.set(taskId, {
          ...task,
          checkpoints: [checkpoint, ...task.checkpoints],
          updated_at: new Date().toISOString()
        });
        return { activeTasks: newTasks };
      }),
      
      setCurrentCheckpoint: (taskId, checkpointId) => set((state) => {
        const task = state.activeTasks.get(taskId);
        if (!task) return state;
        
        const newTasks = new Map(state.activeTasks);
        newTasks.set(taskId, {
          ...task,
          current_checkpoint: checkpointId,
          updated_at: new Date().toISOString()
        });
        return { activeTasks: newTasks };
      }),
      
      getTask: (taskId) => {
        return get().activeTasks.get(taskId);
      },
      
      getAllTasks: () => {
        return Array.from(get().activeTasks.values());
      }
    }),
    {
      name: 'multi-task-store'
    }
  )
); 