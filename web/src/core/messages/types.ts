// Copyright (c) 2025 YADRA

export type MessageRole = "user" | "assistant" | "tool";

export type MessageSource = "input" | "button" | "system";

export interface Message {
  id: string;
  threadId: string;
  agent?:
    | "coordinator"
    | "planner"
    | "researcher"
    | "coder"
    | "reporter"
    | "podcast";
  role: MessageRole;
  isStreaming?: boolean;
  content: string;
  contentChunks: string[];
  toolCalls?: ToolCallRuntime[];
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
