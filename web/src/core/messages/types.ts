// Copyright (c) 2025 YADRA

export type MessageRole = "user" | "assistant"; //此处用来区分后端的llm消息。后端system角色仅在内部system prompt中使用，前端无需考虑。

export type MessageOrigin = "user_input" | "user_button" | "ai_response"; //此处存在技术债务：此处设计思路是反映消息来源是前端交互还是后端，在store层创建消息时未区分、在前端UI层也未真正使用和区分消息来源。

export interface Message {
  id: string;
  threadId: string;
  agent?:
    | "generalmanager"
    | "projectmanager"
    | "researcher"
    | "coder"
    | "reporter"
    | "podcast";
  role: MessageRole;
  isStreaming?: boolean;
  content: string;
  contentChunks: string[];
  reasoningContent?: string;
  reasoningContentChunks?: string[];
  toolCalls?: ToolCallRuntime[];
  toolCallChunks?: ToolCallChunk[];
  options?: Option[];
  finishReason?: "stop" | "interrupt" | "tool_calls" | "reask";
  interruptFeedback?: string;
  resources?: Array<Resource>;
  origin?: MessageOrigin;  // 新字段，预留，用于区分消息来源是前端交互还是后端。
  originalInput?: {
    text: string;
    locale: string;
    settings: Record<string, any>;
    resources: any[];
    timestamp: string;
  };
  metadata?: Record<string, any>;
  langGraphMetadata?: {
    execution_id?: string;
    agent?: string;
    timestamp?: string;
    additional_kwargs?: Record<string, any>;
    response_metadata?: Record<string, any>;
  };
  toolCallId?: string;
  isToolCallsMessage?: boolean;
  isInterruptMessage?: boolean;
  isReaskMessage?: boolean;
  isErrorMessage?: boolean;
}

export interface Option {
  text: string;
  value: string;
}

export interface ToolCallRuntime {
  id: string;
  name: string;
  args: Record<string, unknown>;
  argsChunks?: string[];
  result?: string;
}

export interface Resource {
  uri: string;
  title: string;
}

export interface ToolCallChunk {
  index: number;
  id: string;
  name: string;
  args: string;
}
