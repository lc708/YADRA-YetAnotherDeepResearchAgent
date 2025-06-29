// Google Analytics utilities
// Copyright (c) 2025 YADRA

import { env } from "~/env";

// Extend Window interface to include gtag
declare global {
  interface Window {
    gtag: (command: string, targetId: string, config?: any) => void;
    dataLayer: any[];
  }
}

/**
 * 检查是否启用了Google Analytics
 */
export const isGAEnabled = (): boolean => {
  return !!(env.NEXT_PUBLIC_GA_MEASUREMENT_ID && typeof window !== 'undefined' && window.gtag);
};

/**
 * 发送页面浏览事件
 */
export const trackPageView = (url: string, title?: string): void => {
  if (!isGAEnabled()) return;
  
  window.gtag('config', env.NEXT_PUBLIC_GA_MEASUREMENT_ID!, {
    page_path: url,
    page_title: title || document.title,
  });
};

/**
 * 发送自定义事件
 */
export const trackEvent = (
  action: string,
  eventName: string,
  parameters?: {
    event_category?: string;
    event_label?: string;
    value?: number;
    [key: string]: any;
  }
): void => {
  if (!isGAEnabled()) return;

  window.gtag('event', action, {
    event_category: parameters?.event_category || 'engagement',
    event_label: parameters?.event_label,
    value: parameters?.value,
    ...parameters,
  });
};

/**
 * 跟踪研究任务相关事件
 */
export const trackResearchEvent = (
  action: 'research_start' | 'research_complete' | 'research_error',
  parameters?: {
    research_topic?: string;
    research_type?: string;
    duration?: number;
    [key: string]: any;
  }
): void => {
  trackEvent(action, action, {
    event_category: 'research',
    ...parameters,
  });
};

/**
 * 跟踪用户认证事件
 */
export const trackAuthEvent = (
  action: 'login' | 'logout' | 'signup',
  provider?: string
): void => {
  trackEvent(action, action, {
    event_category: 'auth',
    method: provider,
  });
};

/**
 * 跟踪工作区相关事件
 */
export const trackWorkspaceEvent = (
  action: 'workspace_visit' | 'artifact_view' | 'artifact_export',
  parameters?: {
    artifact_type?: string;
    export_format?: string;
    [key: string]: any;
  }
): void => {
  trackEvent(action, action, {
    event_category: 'workspace',
    ...parameters,
  });
}; 