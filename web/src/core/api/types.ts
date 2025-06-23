// Copyright (c) 2025 YADRA

import type { Option } from "../messages";

// Tool Calls - 保留原生LangGraph工具调用结构

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallChunk {
  index: number;
  id: string;
  name: string;
  args: string;
}

// ✅ 完全抽象的LangGraph原生事件 - 不预定义业务事件类型
export interface LangGraphNativeEvent {
  event: string;  // 原生事件类型：message_chunk, tool_calls, tool_call_result, interrupt, error等
  data: {
    // 🔥 LangGraph原生必需字段
    id: string;
    thread_id: string;
    agent: string;        // 节点名称：projectmanager, researcher, coder, reporter等
    role: "user" | "assistant" | "tool";
    execution_id: string;
    timestamp: string;
    
    // 🔥 LangGraph原生可选字段
    finish_reason?: "stop" | "tool_calls" | "interrupt";
    content?: string;
    
    // 🔥 工具调用相关（当event为tool_calls或tool_call_result时）
    tool_calls?: ToolCall[];
    tool_call_chunks?: ToolCallChunk[];
    tool_call_id?: string;
    
    // 🔥 中断相关（当event为interrupt时）
    options?: Option[];
    
    // 🔥 重问相关（当event为reask时）
    original_input?: {
      text: string;
      locale: string;
      settings: Record<string, any>;
      resources: any[];
      timestamp: string;
    };
    
    // 🔥 错误相关（当event为error时）
    error_code?: string;
    error_message?: string;
    error_details?: Record<string, any>;
    suggestions?: string[];
    
    // 🔥 LangGraph原生元数据
    metadata?: {
      additional_kwargs?: Record<string, any>;
      response_metadata?: Record<string, any>;
    };
    
    // 💡 完全灵活：支持任意LangGraph原生字段和未来扩展
    [key: string]: any;
  };
}

// ✅ 统一事件类型 - 不再硬编码预定义事件
export type ChatEvent = LangGraphNativeEvent;
