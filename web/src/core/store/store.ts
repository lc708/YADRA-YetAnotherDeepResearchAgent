// Copyright (c) 2025 YADRA

import { nanoid } from "nanoid";
import { toast } from "sonner";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

import type { Artifact } from "~/lib/supa";

import { chatStream, generatePodcast } from "../api";
import type { Message, Resource } from "../messages";
import { mergeMessage } from "../messages";
import { parseJSON } from "../utils";

import { getChatStreamSettings } from "./settings-store";

const THREAD_ID = nanoid();

export const useStore = create<{
  responding: boolean;
  threadId: string | undefined;
  messageIds: string[];
  messages: Map<string, Message>;
  researchIds: string[];
  researchPlanIds: Map<string, string>;
  researchReportIds: Map<string, string>;
  researchActivityIds: Map<string, string[]>;
  ongoingResearchId: string | null;
  openResearchId: string | null;
  artifacts: Map<string, Artifact>;
  artifactsByTrace: Map<string, string[]>;

  appendMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  updateMessages: (messages: Message[]) => void;
  openResearch: (researchId: string | null) => void;
  closeResearch: () => void;
  setOngoingResearch: (researchId: string | null) => void;
  addArtifact: (artifact: Artifact) => void;
  updateArtifact: (artifact: Artifact) => void;
  clearConversation: () => void;
}>((set) => ({
  responding: false,
  threadId: THREAD_ID,
  messageIds: [],
  messages: new Map<string, Message>(),
  researchIds: [],
  researchPlanIds: new Map<string, string>(),
  researchReportIds: new Map<string, string>(),
  researchActivityIds: new Map<string, string[]>(),
  ongoingResearchId: null,
  openResearchId: null,
  artifacts: new Map<string, Artifact>(),
  artifactsByTrace: new Map<string, string[]>(),

  appendMessage(message: Message) {
    set((state) => ({
      messageIds: [...state.messageIds, message.id],
      messages: new Map(state.messages).set(message.id, message),
    }));
  },
  updateMessage(message: Message) {
    set((state) => ({
      messages: new Map(state.messages).set(message.id, message),
    }));
  },
  updateMessages(messages: Message[]) {
    set((state) => {
      const newMessages = new Map(state.messages);
      messages.forEach((m) => newMessages.set(m.id, m));
      return { messages: newMessages };
    });
  },
  openResearch(researchId: string | null) {
    set({ openResearchId: researchId });
  },
  closeResearch() {
    set({ openResearchId: null });
  },
  setOngoingResearch(researchId: string | null) {
    set({ ongoingResearchId: researchId });
  },
  addArtifact(artifact: Artifact) {
    set((state) => {
      const newArtifacts = new Map(state.artifacts).set(artifact.id, artifact);
      const traceArtifacts =
        state.artifactsByTrace.get(artifact.trace_id) ?? [];
      const newArtifactsByTrace = new Map(state.artifactsByTrace).set(
        artifact.trace_id,
        [...traceArtifacts, artifact.id],
      );
      return {
        artifacts: newArtifacts,
        artifactsByTrace: newArtifactsByTrace,
      };
    });
  },
  updateArtifact(artifact: Artifact) {
    set((state) => ({
      artifacts: new Map(state.artifacts).set(artifact.id, artifact),
    }));
  },
  clearConversation() {
    set({
      messageIds: [],
      messages: new Map<string, Message>(),
      researchIds: [],
      researchPlanIds: new Map<string, string>(),
      researchReportIds: new Map<string, string>(),
      researchActivityIds: new Map<string, string[]>(),
      ongoingResearchId: null,
      openResearchId: null,
    });
  },
}));

export async function sendMessage(
  content?: string,
  {
    interruptFeedback,
    resources,
  }: {
    interruptFeedback?: string;
    resources?: Array<Resource>;
  } = {},
  options: { abortSignal?: AbortSignal } = {},
) {
  if (content != null) {
    const settings = getChatStreamSettings();
    appendMessage({
      id: nanoid(),
      threadId: THREAD_ID,
      role: "user",
      content: content,
      contentChunks: [content],
      resources,
      originalInput: {
        text: content,
        locale: 'zh-CN', // 默认语言，可以根据需要调整
        settings: {
          enable_background_investigation: settings.enableBackgroundInvestigation ?? true,
          auto_accepted_plan: settings.autoAcceptedPlan,
          report_style: settings.reportStyle,
        },
        resources: resources || [],
        timestamp: new Date().toISOString(),
      },
    });
  }

  const settings = getChatStreamSettings();
  const stream = chatStream(
    content ?? "[REPLAY]",
    {
      thread_id: THREAD_ID,
      interrupt_feedback: interruptFeedback,
      resources,
      auto_accepted_plan: settings.autoAcceptedPlan,
      enable_background_investigation:
        settings.enableBackgroundInvestigation ?? true,
      max_plan_iterations: settings.maxPlanIterations,
      max_step_num: settings.maxStepNum,
      max_search_results: settings.maxSearchResults,
      report_style: settings.reportStyle,
      mcp_settings: settings.mcpSettings,
    },
    options,
  );

  setResponding(true);
  let messageId: string | undefined;
  try {
    for await (const event of stream) {
      const { type, data } = event;
      messageId = data.id;
      let message: Message | undefined;
      if (type === "tool_call_result") {
        message = findMessageByToolCallId(data.tool_call_id);
      } else if (!existsMessage(messageId)) {
        // 查找最近的用户消息以获取originalInput
        let originalInput: any = undefined;
        const messageIds = useStore.getState().messageIds;
        for (let i = messageIds.length - 1; i >= 0; i--) {
          const msg = getMessage(messageIds[i]!);
          if (msg?.role === "user" && msg.originalInput) {
            originalInput = msg.originalInput;
            break;
          }
        }
        
        message = {
          id: messageId,
          threadId: data.thread_id,
          agent: data.agent,
          role: data.role,
          content: "",
          contentChunks: [],
          isStreaming: true,
          interruptFeedback,
          originalInput, // 继承用户消息的originalInput
        };
        appendMessage(message);
      }
      message ??= getMessage(messageId);
      if (message) {
        message = mergeMessage(message, event);
        updateMessage(message);
      }
    }
  } catch (error) {
    // 改进错误处理，区分AbortError和其他错误
    if (error instanceof Error && error.name === 'AbortError') {
      console.log("Request was aborted");
      // AbortError是正常的取消操作，不需要显示错误提示
    } else {
      console.error("Error in sendMessage:", error);
      toast("An error occurred while generating the response. Please try again.");
    }
    
    // Update message status.
    if (messageId != null) {
      const message = getMessage(messageId);
      if (message?.isStreaming) {
        message.isStreaming = false;
        useStore.getState().updateMessage(message);
      }
    }
    useStore.getState().setOngoingResearch(null);
    
    // 重新抛出非AbortError，让调用方处理
    if (!(error instanceof Error && error.name === 'AbortError')) {
      throw error;
    }
  } finally {
    setResponding(false);
  }
}

function setResponding(value: boolean) {
  useStore.setState({ responding: value });
}

function existsMessage(id: string) {
  return useStore.getState().messageIds.includes(id);
}

function getMessage(id: string) {
  return useStore.getState().messages.get(id);
}

function findMessageByToolCallId(toolCallId: string) {
  return Array.from(useStore.getState().messages.values())
    .reverse()
    .find((message) => {
      if (message.toolCalls) {
        return message.toolCalls.some((toolCall) => toolCall.id === toolCallId);
      }
      return false;
    });
}

function appendMessage(message: Message) {
  if (
    message.agent === "coder" ||
    message.agent === "reporter" ||
    message.agent === "researcher"
  ) {
    if (!getOngoingResearchId()) {
      const id = message.id;
      appendResearch(id);
      openResearch(id);
    }
    appendResearchActivity(message);
  }
  useStore.getState().appendMessage(message);
}

function updateMessage(message: Message) {
  if (
    getOngoingResearchId() &&
    message.agent === "reporter" &&
    !message.isStreaming
  ) {
    useStore.getState().setOngoingResearch(null);
  }
  useStore.getState().updateMessage(message);
}

function getOngoingResearchId() {
  return useStore.getState().ongoingResearchId;
}

function appendResearch(researchId: string) {
  let planMessage: Message | undefined;
  const reversedMessageIds = [...useStore.getState().messageIds].reverse();
  for (const messageId of reversedMessageIds) {
    const message = getMessage(messageId);
    if (message?.agent === "planner") {
      planMessage = message;
      break;
    }
  }
  const messageIds = [researchId];
  messageIds.unshift(planMessage!.id);
  useStore.setState({
    ongoingResearchId: researchId,
    researchIds: [...useStore.getState().researchIds, researchId],
    researchPlanIds: new Map(useStore.getState().researchPlanIds).set(
      researchId,
      planMessage!.id,
    ),
    researchActivityIds: new Map(useStore.getState().researchActivityIds).set(
      researchId,
      messageIds,
    ),
  });
}

function appendResearchActivity(message: Message) {
  const researchId = getOngoingResearchId();
  if (researchId) {
    const researchActivityIds = useStore.getState().researchActivityIds;
    const current = researchActivityIds.get(researchId)!;
    if (!current.includes(message.id)) {
      useStore.setState({
        researchActivityIds: new Map(researchActivityIds).set(researchId, [
          ...current,
          message.id,
        ]),
      });
    }
    if (message.agent === "reporter") {
      useStore.setState({
        researchReportIds: new Map(useStore.getState().researchReportIds).set(
          researchId,
          message.id,
        ),
      });
    }
  }
}

export function openResearch(researchId: string | null) {
  useStore.getState().openResearch(researchId);
}

export function closeResearch() {
  useStore.getState().closeResearch();
}

export async function listenToPodcast(researchId: string) {
  const planMessageId = useStore.getState().researchPlanIds.get(researchId);
  const reportMessageId = useStore.getState().researchReportIds.get(researchId);
  if (planMessageId && reportMessageId) {
    const planMessage = getMessage(planMessageId)!;
    const title = parseJSON(planMessage.content, { title: "Untitled" }).title;
    const reportMessage = getMessage(reportMessageId);
    if (reportMessage?.content) {
      appendMessage({
        id: nanoid(),
        threadId: THREAD_ID,
        role: "user",
        content: "Please generate a podcast for the above research.",
        contentChunks: [],
      });
      const podCastMessageId = nanoid();
      const podcastObject = { title, researchId };
      const podcastMessage: Message = {
        id: podCastMessageId,
        threadId: THREAD_ID,
        role: "assistant",
        agent: "podcast",
        content: JSON.stringify(podcastObject),
        contentChunks: [],
        isStreaming: true,
      };
      appendMessage(podcastMessage);
      // Generating podcast...
      let audioUrl: string | undefined;
      try {
        audioUrl = await generatePodcast(reportMessage.content);
      } catch (e) {
        console.error(e);
        useStore.setState((state) => ({
          messages: new Map(useStore.getState().messages).set(
            podCastMessageId,
            {
              ...state.messages.get(podCastMessageId)!,
              content: JSON.stringify({
                ...podcastObject,
                error: e instanceof Error ? e.message : "Unknown error",
              }),
              isStreaming: false,
            },
          ),
        }));
        toast("An error occurred while generating podcast. Please try again.");
        return;
      }
      useStore.setState((state) => ({
        messages: new Map(useStore.getState().messages).set(podCastMessageId, {
          ...state.messages.get(podCastMessageId)!,
          content: JSON.stringify({ ...podcastObject, audioUrl }),
          isStreaming: false,
        }),
      }));
    }
  }
}

export function useResearchMessage(researchId: string) {
  return useStore(
    useShallow((state) => {
      const messageId = state.researchPlanIds.get(researchId);
      return messageId ? state.messages.get(messageId) : undefined;
    }),
  );
}

export function useMessage(messageId: string | null | undefined) {
  return useStore(
    useShallow((state) =>
      messageId ? state.messages.get(messageId) : undefined,
    ),
  );
}

export function useMessageIds() {
  return useStore(useShallow((state) => state.messageIds));
}

export function useLastInterruptMessage() {
  return useStore(
    useShallow((state) => {
      if (state.messageIds.length >= 2) {
        const lastMessage = state.messages.get(
          state.messageIds[state.messageIds.length - 1]!,
        );
        return lastMessage?.finishReason === "interrupt" ? lastMessage : null;
      }
      return null;
    }),
  );
}

export function useLastFeedbackMessageId() {
  const waitingForFeedbackMessageId = useStore(
    useShallow((state) => {
      if (state.messageIds.length >= 2) {
        const lastMessage = state.messages.get(
          state.messageIds[state.messageIds.length - 1]!,
        );
        if (lastMessage && lastMessage.finishReason === "interrupt") {
          return state.messageIds[state.messageIds.length - 2];
        }
      }
      return null;
    }),
  );
  return waitingForFeedbackMessageId;
}

export function useToolCalls() {
  return useStore(
    useShallow((state) => {
      return state.messageIds
        ?.map((id) => getMessage(id)?.toolCalls)
        .filter((toolCalls) => toolCalls != null)
        .flat();
    }),
  );
}

// ============================================================================
// Workspace适配器集成
// ============================================================================

import { workspaceStateAdapter } from "~/core/adapters/state-adapter";
import { useWorkspaceStore } from "~/core/store/workspace-store";

/**
 * 同步主store状态到workspace store的适配器函数
 */
export function syncStateToWorkspace(traceId: string) {
  const mainState = useStore.getState();
  
  // 使用适配器生成artifacts
  const artifacts = workspaceStateAdapter.getArtifactsForTrace(
    mainState.messages,
    mainState.messageIds,
    mainState.researchIds,
    mainState.researchPlanIds,
    mainState.researchReportIds,
    mainState.researchActivityIds,
    traceId
  );
  
  // 更新workspace store
  const workspaceState = useWorkspaceStore.getState();
  const newAdaptedArtifacts = new Map(workspaceState.adaptedArtifacts);
  const newLastUpdateTime = new Map(workspaceState.lastUpdateTime);
  
  newAdaptedArtifacts.set(traceId, artifacts);
  newLastUpdateTime.set(traceId, Date.now());
  
  useWorkspaceStore.setState({
    adaptedArtifacts: newAdaptedArtifacts,
    lastUpdateTime: newLastUpdateTime,
  });
  
  // 同时更新主store的artifacts映射
  const artifactMap = new Map(mainState.artifacts);
  const artifactsByTraceMap = new Map(mainState.artifactsByTrace);
  
  artifacts.forEach(artifact => {
    artifactMap.set(artifact.id, artifact);
  });
  
  artifactsByTraceMap.set(traceId, artifacts.map(a => a.id));
  
  useStore.setState({
    artifacts: artifactMap,
    artifactsByTrace: artifactsByTraceMap,
  });
}

/**
 * 监听主store变化并自动同步到workspace
 */
let isSubscribed = false;

export function enableWorkspaceSync() {
  if (isSubscribed) return;
  
  isSubscribed = true;
  
  // 监听消息变化
  let lastMessageCount = 0;
  useStore.subscribe((state) => {
    const currentTraceId = useWorkspaceStore.getState().currentTraceId;
    if (currentTraceId && state.messageIds.length !== lastMessageCount) {
      lastMessageCount = state.messageIds.length;
      // 延迟同步，避免在消息流式传输过程中频繁更新
      setTimeout(() => {
        syncStateToWorkspace(currentTraceId);
      }, 100);
    }
  });
  
  // 监听研究状态变化
  let lastResearchCount = 0;
  useStore.subscribe((state) => {
    const currentTraceId = useWorkspaceStore.getState().currentTraceId;
    if (currentTraceId && state.researchIds.length !== lastResearchCount) {
      lastResearchCount = state.researchIds.length;
      setTimeout(() => {
        syncStateToWorkspace(currentTraceId);
      }, 100);
    }
  });
}

/**
 * 获取当前workspace的artifacts
 */
export function useWorkspaceArtifacts() {
  const currentTraceId = useWorkspaceStore((state) => state.currentTraceId);
  const artifacts = useWorkspaceStore((state) => 
    currentTraceId ? state.adaptedArtifacts.get(currentTraceId) || [] : []
  );
  
  return { artifacts, traceId: currentTraceId };
}

/**
 * 初始化workspace集成
 * 应该在应用启动时调用
 */
export function initializeWorkspaceIntegration() {
  enableWorkspaceSync();
  
  // 如果已经有当前traceId，立即同步一次
  const currentTraceId = useWorkspaceStore.getState().currentTraceId;
  if (currentTraceId) {
    syncStateToWorkspace(currentTraceId);
  }
}
