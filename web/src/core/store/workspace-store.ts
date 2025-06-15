// Copyright (c) 2025 YADRA

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

import { workspaceStateAdapter } from "~/core/adapters/state-adapter";
import type { Message, Option } from "~/core/messages";
import type { Artifact } from "~/lib/supa";

/**
 * 工作区状态接口
 */
export interface WorkspaceState {
  // 当前工作区的traceId
  currentTraceId: string | null;
  
  // UI状态控制
  conversationPanelVisible: boolean;
  artifactsPanelVisible: boolean;
  
  // 反馈系统状态
  feedback: { option: Option } | null;
  
  // 适配后的artifacts缓存 (traceId -> artifacts)
  adaptedArtifacts: Map<string, Artifact[]>;
  
  // 最后更新时间 (用于缓存失效)
  lastUpdateTime: Map<string, number>;
}

/**
 * 工作区操作接口
 */
export interface WorkspaceActions {
  // 设置当前traceId
  setCurrentTraceId: (traceId: string | null) => void;
  
  // UI面板控制
  toggleConversationPanel: () => void;
  toggleArtifactsPanel: () => void;
  setConversationPanelVisible: (visible: boolean) => void;
  setArtifactsPanelVisible: (visible: boolean) => void;
  
  // 反馈系统操作
  setFeedback: (feedback: { option: Option } | null) => void;
  removeFeedback: () => void;
  
  // 刷新指定trace的artifacts
  refreshArtifactsForTrace: (traceId: string) => void;
  
  // 获取指定trace的artifacts
  getArtifactsForTrace: (traceId: string) => Artifact[];
  
  // 清除artifacts缓存
  clearArtifactsCache: (traceId?: string) => void;
}

/**
 * 完整的工作区store类型
 */
export type WorkspaceStore = WorkspaceState & WorkspaceActions;

/**
 * 工作区状态管理器
 * 
 * 设计原则:
 * 1. 不直接依赖主store，通过适配器获取数据
 * 2. 缓存适配后的artifacts，避免重复计算
 * 3. 监听主store变化，自动更新缓存
 * 4. 提供UI状态管理功能
 */
export const useWorkspaceStore = create<WorkspaceStore>()(
  subscribeWithSelector((set, get) => ({
    // 初始状态
    currentTraceId: null,
    conversationPanelVisible: true,
    artifactsPanelVisible: true,
    feedback: null,
    adaptedArtifacts: new Map(),
    lastUpdateTime: new Map(),
    
    // Actions
    setCurrentTraceId: (traceId: string | null) => {
      set({ currentTraceId: traceId });
    },
    
    toggleConversationPanel: () => {
      set((state) => ({
        conversationPanelVisible: !state.conversationPanelVisible,
      }));
    },
    
    toggleArtifactsPanel: () => {
      set((state) => ({
        artifactsPanelVisible: !state.artifactsPanelVisible,
      }));
    },
    
    setConversationPanelVisible: (visible: boolean) => {
      set({ conversationPanelVisible: visible });
    },
    
    setArtifactsPanelVisible: (visible: boolean) => {
      set({ artifactsPanelVisible: visible });
    },
    
    setFeedback: (feedback: { option: Option } | null) => {
      set({ feedback });
    },
    
    removeFeedback: () => {
      set({ feedback: null });
    },
    
    refreshArtifactsForTrace: (traceId: string) => {
      // 由于需要从主store获取数据，这个函数会在下面的useWorkspaceAdapter中实现
      // 这里只是更新缓存失效时间
      const state = get();
      const newLastUpdateTime = new Map(state.lastUpdateTime);
      newLastUpdateTime.set(traceId, Date.now());
      set({ lastUpdateTime: newLastUpdateTime });
    },
    
    getArtifactsForTrace: (traceId: string) => {
      const state = get();
      return state.adaptedArtifacts.get(traceId) || [];
    },
    
    clearArtifactsCache: (traceId?: string) => {
      const state = get();
      if (traceId) {
        const newAdaptedArtifacts = new Map(state.adaptedArtifacts);
        const newLastUpdateTime = new Map(state.lastUpdateTime);
        newAdaptedArtifacts.delete(traceId);
        newLastUpdateTime.delete(traceId);
        set({ 
          adaptedArtifacts: newAdaptedArtifacts,
          lastUpdateTime: newLastUpdateTime 
        });
      } else {
        set({ 
          adaptedArtifacts: new Map(),
          lastUpdateTime: new Map() 
        });
      }
    },
  }))
);

/**
 * 工作区适配器钩子
 * 
 * 负责监听主store的变化并自动更新workspace artifacts缓存
 */
export function useWorkspaceAdapter(traceId: string | null) {
  // 这个钩子会在实际使用时导入主store
  // 为了避免循环依赖，我们在这里不直接导入useStore
  
  return {
    // 提供刷新artifacts的方法
    refreshArtifacts: () => {
      if (traceId) {
        useWorkspaceStore.getState().refreshArtifactsForTrace(traceId);
      }
    },
    
    // 提供获取artifacts的方法
    getArtifacts: () => {
      if (!traceId) return [];
      return useWorkspaceStore.getState().getArtifactsForTrace(traceId);
    },
  };
}

// 选择器钩子
export const useCurrentTraceId = () => 
  useWorkspaceStore(useShallow((state) => state.currentTraceId));

export const useConversationPanelVisible = () => 
  useWorkspaceStore(useShallow((state) => state.conversationPanelVisible));

export const useArtifactsPanelVisible = () => 
  useWorkspaceStore(useShallow((state) => state.artifactsPanelVisible));

export const useWorkspaceArtifacts = (traceId: string | null) => 
  useWorkspaceStore(useShallow((state) => 
    traceId ? state.adaptedArtifacts.get(traceId) || [] : []
  ));

export const useWorkspaceFeedback = () => 
  useWorkspaceStore(useShallow((state) => state.feedback));

/**
 * 用于在组件中快速访问workspace操作的钩子
 */
export const useWorkspaceActions = () => {
  return useWorkspaceStore(useShallow((state) => ({
    setCurrentTraceId: state.setCurrentTraceId,
    toggleConversationPanel: state.toggleConversationPanel,
    toggleArtifactsPanel: state.toggleArtifactsPanel,
    setConversationPanelVisible: state.setConversationPanelVisible,
    setArtifactsPanelVisible: state.setArtifactsPanelVisible,
    setFeedback: state.setFeedback,
    removeFeedback: state.removeFeedback,
    refreshArtifactsForTrace: state.refreshArtifactsForTrace,
    clearArtifactsCache: state.clearArtifactsCache,
  })));
}; 