// Copyright (c) 2025 YADRA

import type {
  ChatEvent,
  LangGraphNativeEvent,
  ToolCall,
} from "../api";
import { cloneMessage } from "../utils/deep-clone";

import type { Message, ToolCallChunk } from "./types";

export function mergeMessage(message: Message, event: ChatEvent): Message {
  const clonedMessage = cloneMessage(message);
  
  // Unified event handling: support both "type" and "event" formats
  const eventType = event.event;
  
  if (eventType === "message_chunk") {
    mergeLangGraphTextMessage(clonedMessage, event);
  } else if (eventType === "tool_calls") {
    mergeToolCallsMessage(clonedMessage, event);
  } else if (eventType === "tool_call_chunks") {
    mergeToolCallChunksMessage(clonedMessage, event);
  } else if (eventType === "tool_call_result") {
    mergeToolCallResultMessage(clonedMessage, event);
  } else if (eventType === "interrupt") {
    mergeInterruptMessage(clonedMessage, event);
  } else if (eventType === "reask") {
    mergeReaskMessage(clonedMessage, event);
  } else if (eventType === "error") {
    mergeErrorMessage(clonedMessage, event);
  } else if (eventType === "metadata") {
    mergeMetadataMessage(clonedMessage, event);
  } else if (eventType === "complete") {
    mergeCompleteMessage(clonedMessage, event);
  }
  
  // Unified handling of finish_reason and streaming status
  if (event.data.finish_reason) {
    clonedMessage.finishReason = event.data.finish_reason;
    clonedMessage.isStreaming = false;
    
    // Handle tool call parameter concatenation on completion
    if (clonedMessage.toolCalls) {
      clonedMessage.toolCalls.forEach((toolCall) => {
        if (toolCall.argsChunks?.length) {
          try {
            toolCall.args = JSON.parse(toolCall.argsChunks.join(""));
            delete toolCall.argsChunks;
          } catch (e) {
            console.warn("Failed to parse tool call args:", e);
          }
        }
      });
    }
  }
  
  return clonedMessage;
}

// Handle message_chunk event: text content concatenation
function mergeLangGraphTextMessage(message: Message, event: LangGraphNativeEvent) {
  // Handle main content
  if (event.data.content) {
    message.content = (message.content || "") + event.data.content;
    message.contentChunks = [...(message.contentChunks || []), event.data.content];
  }
  
  // Handle reasoning_content
  if (event.data.reasoning_content) {
    message.reasoningContent = (message.reasoningContent || "") + event.data.reasoning_content;
    message.reasoningContentChunks = [...(message.reasoningContentChunks || []), event.data.reasoning_content];
  }
  
  // Save LangGraph native metadata
  saveLangGraphMetadata(message, event);
}

// Handle tool_calls event: complete tool calls
function mergeToolCallsMessage(message: Message, event: LangGraphNativeEvent) {
  if (event.data.tool_calls?.[0]?.name) {
    message.toolCalls = event.data.tool_calls.map((raw: any) => ({
      id: raw.id,
      name: raw.name,
      args: raw.args,
      argsChunks: [], // Initialize as empty, wait for subsequent chunks
    }));
    message.isToolCallsMessage = true;
  }
  
  // 🔥 同时处理tool_call_chunks（如果存在）
  if (event.data.tool_call_chunks?.length) {
    message.toolCallChunks = [...(message.toolCallChunks || []), ...event.data.tool_call_chunks];
  }
  
  // 处理内容和reasoning_content
  if (event.data.content) {
    message.content = (message.content || "") + event.data.content;
    message.contentChunks = [...(message.contentChunks || []), event.data.content];
  }
  
  if (event.data.reasoning_content) {
    message.reasoningContent = (message.reasoningContent || "") + event.data.reasoning_content;
    message.reasoningContentChunks = [...(message.reasoningContentChunks || []), event.data.reasoning_content];
  }
  
  saveLangGraphMetadata(message, event);
}

// 🔥 处理tool_call_chunks事件：工具调用片段累积
function mergeToolCallChunksMessage(message: Message, event: LangGraphNativeEvent) {
  if (event.data.tool_call_chunks?.length) {
    message.toolCallChunks = [...(message.toolCallChunks || []), ...event.data.tool_call_chunks];
    
    // 🔥 尝试将chunks累积到对应的toolCalls中
    if (message.toolCalls) {
      event.data.tool_call_chunks.forEach((chunk: ToolCallChunk) => {
        const toolCall = message.toolCalls?.find(tc => tc.id === chunk.id);
        if (toolCall?.argsChunks) {
          toolCall.argsChunks.push(chunk.args);
        }
      });
    }
  }
  
  // 处理内容和reasoning_content
  if (event.data.content) {
    message.content = (message.content || "") + event.data.content;
    message.contentChunks = [...(message.contentChunks || []), event.data.content];
  }
  
  if (event.data.reasoning_content) {
    message.reasoningContent = (message.reasoningContent || "") + event.data.reasoning_content;
    message.reasoningContentChunks = [...(message.reasoningContentChunks || []), event.data.reasoning_content];
  }
  
  saveLangGraphMetadata(message, event);
}

// 🔥 处理tool_call_result事件：工具调用结果
function mergeToolCallResultMessage(message: Message, event: LangGraphNativeEvent) {
  // 保存tool_call_id用于关联
  if (event.data.tool_call_id) {
    message.toolCallId = event.data.tool_call_id;
    
    // 🔥 尝试将结果关联到对应的toolCall
    if (message.toolCalls) {
      const toolCall = message.toolCalls.find(tc => tc.id === event.data.tool_call_id);
      if (toolCall && event.data.content) {
        toolCall.result = (toolCall.result || "") + event.data.content;
      }
    }
  }
  
  // 处理内容
  if (event.data.content) {
    message.content = (message.content || "") + event.data.content;
    message.contentChunks = [...(message.contentChunks || []), event.data.content];
  }
  
  saveLangGraphMetadata(message, event);
}

// 🔥 处理interrupt事件：中断和选项
function mergeInterruptMessage(message: Message, event: LangGraphNativeEvent) {
  if (event.data.options) {
    message.options = event.data.options;
    message.isInterruptMessage = true;
  }
  
  if (event.data.content) {
    message.content = (message.content || "") + event.data.content;
    message.contentChunks = [...(message.contentChunks || []), event.data.content];
  }
  
  saveLangGraphMetadata(message, event);
}

// 🔥 处理reask事件：重新提问
function mergeReaskMessage(message: Message, event: LangGraphNativeEvent) {
  if (event.data.original_input) {
    message.originalInput = event.data.original_input;
    message.isReaskMessage = true;
  }
  
  if (event.data.content) {
    message.content = (message.content || "") + event.data.content;
    message.contentChunks = [...(message.contentChunks || []), event.data.content];
  }
  
  saveLangGraphMetadata(message, event);
}

// 🔥 处理error事件：错误信息
function mergeErrorMessage(message: Message, event: LangGraphNativeEvent) {
  if (event.data.error_message) {
    const errorContent = `[Error] ${event.data.error_message}`;
    message.content = (message.content || "") + errorContent;
    message.contentChunks = [...(message.contentChunks || []), errorContent];
    message.isErrorMessage = true;
  }
  
  saveLangGraphMetadata(message, event);
}

// 🔥 处理metadata事件：研究开始元数据
function mergeMetadataMessage(message: Message, event: LangGraphNativeEvent) {
  // metadata事件通常不包含content，主要是保存元数据
  saveLangGraphMetadata(message, event);
}

// 🔥 处理complete事件：研究完成
function mergeCompleteMessage(message: Message, event: LangGraphNativeEvent) {
  // complete事件标记研究结束
  message.isStreaming = false;
  if (event.data.final_status) {
    message.finishReason = "stop";
  }
  
  saveLangGraphMetadata(message, event);
}

// 🔥 统一保存LangGraph原生元数据
function saveLangGraphMetadata(message: Message, event: LangGraphNativeEvent) {
  if (event.data.execution_id || event.data.agent || event.data.timestamp || event.data.metadata) {
    message.langGraphMetadata = {
      ...message.langGraphMetadata,
      execution_id: event.data.execution_id,
      agent: event.data.agent,
      timestamp: event.data.timestamp,
      additional_kwargs: event.data.metadata?.additional_kwargs,
      response_metadata: event.data.metadata?.response_metadata,
    };
  }
}
