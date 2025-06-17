// Copyright (c) 2025 YADRA

import { env } from "~/env";

import type { MCPServerMetadata } from "../mcp";
import type { Resource } from "../messages";
import { extractReplayIdFromSearchParams } from "../replay/get-replay-id";
import { fetchStream } from "../sse";
import { sleep } from "../utils";

import { resolveServiceURL } from "./resolve-service-url";
import type { ChatEvent } from "./types";
import { getChatStreamSettings } from "~/core/store/settings-store";

export type ReportStyle = "academic" | "popular_science" | "news" | "social_media";

export interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  thread_id?: string;
  resources: Resource[];
  auto_accepted_plan: boolean;
  max_plan_iterations: number;
  max_step_num: number;
  max_search_results: number;
  enable_background_investigation: boolean;
  report_style: ReportStyle;
  enable_deep_thinking: boolean;
  mcp_settings: Record<string, any>;
  interrupt_feedback?: string;
}

export async function* chatStream(
  userMessage: string,
  params: {
    thread_id: string;
    resources?: Array<Resource>;
    auto_accepted_plan: boolean;
    max_plan_iterations: number;
    max_step_num: number;
    max_search_results?: number;
    interrupt_feedback?: string;
    enable_deep_thinking?: boolean;
    enable_background_investigation: boolean;
    report_style?: "academic" | "popular_science" | "news" | "social_media";
    mcp_settings?: {
      servers: Record<
        string,
        MCPServerMetadata & {
          enabled_tools: string[];
          add_to_agents: string[];
        }
      >;
    };
  },
  options: { abortSignal?: AbortSignal } = {},
) {
  if (
    env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY ||
    location.search.includes("mock") ||
    location.search.includes("replay=")
  )
    return yield* chatReplayStream(userMessage, params, options);

  try {
    const stream = fetchStream(resolveServiceURL("chat/stream"), {
      body: JSON.stringify({
        messages: [{ role: "user", content: userMessage }],
        ...params,
      }),
      signal: options.abortSignal,
    });

    for await (const event of stream) {
      yield {
        type: event.event,
        data: JSON.parse(event.data),
      } as ChatEvent;
    }
  } catch (e) {
    console.error(e);
  }
}

async function* chatReplayStream(
  userMessage: string,
  params: {
    thread_id: string;
    auto_accepted_plan: boolean;
    max_plan_iterations: number;
    max_step_num: number;
    max_search_results?: number;
    interrupt_feedback?: string;
  } = {
    thread_id: "__mock__",
    auto_accepted_plan: false,
    max_plan_iterations: 3,
    max_step_num: 1,
    max_search_results: 3,
    interrupt_feedback: undefined,
  },
  options: { abortSignal?: AbortSignal } = {},
): AsyncIterable<ChatEvent> {
  const urlParams = new URLSearchParams(window.location.search);
  let replayFilePath = "";
  if (urlParams.has("mock")) {
    if (urlParams.get("mock")) {
      replayFilePath = `/mock/${urlParams.get("mock")!}.txt`;
    } else {
      if (params.interrupt_feedback === "accepted") {
        replayFilePath = "/mock/final-answer.txt";
      } else if (params.interrupt_feedback === "edit_plan") {
        replayFilePath = "/mock/re-plan.txt";
      } else {
        replayFilePath = "/mock/first-plan.txt";
      }
    }
    fastForwardReplaying = true;
  } else {
    const replayId = extractReplayIdFromSearchParams(window.location.search);
    if (replayId) {
      replayFilePath = `/replay/${replayId}.txt`;
    } else {
      // Fallback to a default replay
      replayFilePath = `/replay/eiffel-tower-vs-tallest-building.txt`;
    }
  }
  const text = await fetchReplay(replayFilePath, {
    abortSignal: options.abortSignal,
  });
  const normalizedText = text.replace(/\r\n/g, "\n");
  const chunks = normalizedText.split("\n\n");
  for (const chunk of chunks) {
    const [eventRaw, dataRaw] = chunk.split("\n") as [string, string];
    const [, event] = eventRaw.split("event: ", 2) as [string, string];
    const [, data] = dataRaw.split("data: ", 2) as [string, string];

    try {
      const chatEvent = {
        type: event,
        data: JSON.parse(data),
      } as ChatEvent;
      if (chatEvent.type === "message_chunk") {
        if (!chatEvent.data.finish_reason) {
          await sleepInReplay(50);
        }
      } else if (chatEvent.type === "tool_call_result") {
        await sleepInReplay(500);
      }
      yield chatEvent;
      if (chatEvent.type === "tool_call_result") {
        await sleepInReplay(800);
      } else if (chatEvent.type === "message_chunk") {
        if (chatEvent.data.role === "user") {
          await sleepInReplay(500);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}

const replayCache = new Map<string, string>();
export async function fetchReplay(
  url: string,
  options: { abortSignal?: AbortSignal } = {},
) {
  if (replayCache.has(url)) {
    return replayCache.get(url)!;
  }
  const res = await fetch(url, {
    signal: options.abortSignal,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch replay: ${res.statusText}`);
  }
  const text = await res.text();
  replayCache.set(url, text);
  return text;
}

export async function fetchReplayTitle() {
  const res = chatReplayStream(
    "",
    {
      thread_id: "__mock__",
      auto_accepted_plan: false,
      max_plan_iterations: 3,
      max_step_num: 1,
      max_search_results: 3,
    },
    {},
  );
  for await (const event of res) {
    if (event.type === "message_chunk") {
      return event.data.content;
    }
  }
}

export async function sleepInReplay(ms: number) {
  if (fastForwardReplaying) {
    await sleep(0);
  } else {
    await sleep(ms);
  }
}

let fastForwardReplaying = false;
export function fastForwardReplay(value: boolean) {
  fastForwardReplaying = value;
}

export async function sendMessageAndGetThreadId(
  content: string,
  options: {
    resources?: Array<Resource>;
    enableBackgroundInvestigation?: boolean;
    reportStyle?: string;
    enableDeepThinking?: boolean;
  } = {}
): Promise<{ threadId: string }> {
  const settings = getChatStreamSettings();
  
  // 准备请求数据
  const requestData: ChatRequest = {
    messages: [{ role: "user", content }],
    thread_id: undefined, // 让后端生成
    resources: options.resources || [],
    auto_accepted_plan: false,
    max_plan_iterations: 3,
    max_step_num: 10,
    max_search_results: 10,
    enable_background_investigation: options.enableBackgroundInvestigation ?? settings.enableBackgroundInvestigation ?? true,
    report_style: (options.reportStyle || settings.reportStyle || "academic") as ReportStyle,
    enable_deep_thinking: options.enableDeepThinking ?? settings.enableDeepThinking ?? false,
    mcp_settings: {},
  };

  // 创建新的 AbortController
  const abortController = new AbortController();
  
  // 设置超时
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, 10000); // 10秒超时

  try {
    const stream = fetchStream(resolveServiceURL("chat/stream"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
      signal: abortController.signal,
    });
    
    // 遍历 AsyncIterable
    for await (const event of stream) {
      if (event.event === 'thread_created' && event.data) {
        try {
          const data = JSON.parse(event.data);
          if (data.thread_id) {
            clearTimeout(timeoutId);
            // 立即返回 thread_id
            return { threadId: data.thread_id };
          }
        } catch (e) {
          console.error('Failed to parse thread_created event:', e);
        }
      }
    }
    
    clearTimeout(timeoutId);
    // 如果没有收到 thread_id，则拒绝
    throw new Error('No thread_id received from server');
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}
