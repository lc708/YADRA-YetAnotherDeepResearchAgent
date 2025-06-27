// Copyright (c) 2025 YADRA

import { type StreamEvent } from "./StreamEvent";

export async function* fetchStream(
  url: string,
  init: RequestInit,
): AsyncIterable<StreamEvent> {
  const startTime = performance.now();

  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    ...init,
  });
  
  const responseTime = performance.now();

  
  if (response.status !== 200) {
    throw new Error(`Failed to fetch from ${url}: ${response.status}`);
  }
  
  // Read from response body, event by event. An event always ends with a '\n\n'.
  const reader = response.body
    ?.pipeThrough(new TextDecoderStream())
    .getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }
  
  let buffer = "";
  // 🔥 添加状态跟踪，处理跨chunk的事件
  let pendingEvent: string | null = null;
  let eventCount = 0;
  let lastEventTime = responseTime;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      const endTime = performance.now();

      break;
    }
    
    buffer += value;
    while (true) {
      const index = buffer.indexOf("\n\n");
      if (index === -1) {
        break;
      }
      const chunk = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      
      // 🔥 改进的事件解析逻辑
      const event = parseEvent(chunk, pendingEvent);
      if (event) {
        const currentTime = performance.now();
        const timeSinceLastEvent = currentTime - lastEventTime;
        eventCount++;
        

        
        yield event;
        pendingEvent = null; // 重置pending状态
        lastEventTime = currentTime;
      } else {
        // 🔥 检查是否有pending的event类型
        const eventType = extractEventType(chunk);
        if (eventType) {
          pendingEvent = eventType;
        }
      }
    }
  }
}

// 🔥 新增：提取事件类型的辅助函数
function extractEventType(chunk: string): string | null {
  for (const line of chunk.split("\n")) {
    if (line.trim() === "" || line.startsWith(":")) {
      continue;
    }
    const pos = line.indexOf(": ");
    if (pos !== -1) {
      const key = line.slice(0, pos);
      const value = line.slice(pos + 2);
      if (key === "event") {
        return value;
      }
    }
  }
  return null;
}

function parseEvent(chunk: string, pendingEvent?: string | null) {
  let resultEvent = pendingEvent || "message"; // 🔥 使用pending event作为默认值
  let resultData: string | null = null;
  
  for (const line of chunk.split("\n")) {
    // 🔥 跳过空行
    if (line.trim() === "") {
      continue;
    }
    
    // 🔥 跳过heartbeat注释行
    if (line.startsWith(":")) {
      continue;
    }
    
    const pos = line.indexOf(": ");
    if (pos === -1) {
      continue;
    }
    const key = line.slice(0, pos);
    const value = line.slice(pos + 2);
    if (key === "event") {
      resultEvent = value;
    } else if (key === "data") {
      resultData = value;
    }
  }
  
  // 🔥 修复：只有当有event但没有data时才返回undefined
  // 这样可以避免heartbeat导致的事件丢失
  if (resultData === null || resultData === "") {
    // 如果有明确的event类型但没有数据，说明这可能是一个不完整的事件
    // 在这种情况下，我们仍然返回undefined，但会记录日志
    if (resultEvent !== "message") {
      console.warn(`[SSE] Event '${resultEvent}' has no data, skipping`);
    }
    return undefined;
  }
  
  return {
    event: resultEvent,
    data: resultData,
  } as StreamEvent;
}
