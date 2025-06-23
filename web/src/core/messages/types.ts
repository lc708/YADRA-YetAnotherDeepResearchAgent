// Copyright (c) 2025 YADRA

export type MessageRole = "user" | "assistant" | "tool";

export type MessageSource = "input" | "button" | "system";

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
  source?: MessageSource;
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
