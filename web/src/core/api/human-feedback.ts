/**
 * Human Feedback API - 处理PlanCard的人机反馈
 * 通过/api/chat/stream的interrupt_feedback机制与LangGraph交互
 */

import { chatStream, buildChatStreamParams } from './chat';

export interface HumanFeedbackOptions {
  threadId: string;
  planId?: string;
  feedback: 'accepted' | 'edit_plan' | 'skip_research' | 'reask';
  message?: string; // 编辑计划时的修改建议
}

/**
 * 发送人机反馈到LangGraph
 */
export async function sendHumanFeedback(options: HumanFeedbackOptions): Promise<void> {
  const { threadId, feedback, message } = options;
  
  // 构建反馈消息
  let feedbackMessage = '';
  switch (feedback) {
    case 'accepted':
      feedbackMessage = '开始研究';
      break;
    case 'edit_plan':
      feedbackMessage = message || '请修改计划';
      break;
    case 'skip_research':
      feedbackMessage = '立即输出报告';
      break;
    case 'reask':
      feedbackMessage = '重新提问';
      break;
  }
  
  // 使用chatStream发送interrupt_feedback
  const chatParams = buildChatStreamParams(threadId, {
    interrupt_feedback: feedback,
    auto_accepted_plan: false
  });
  
  // 启动流式对话但不处理结果（仅触发LangGraph恢复）
  const stream = chatStream(feedbackMessage, chatParams);
  
  // 启动流但不等待完成（后续的SSE会处理响应）
  stream.next().catch(console.error);
}

/**
 * PlanCard按钮操作映射
 */
export const PlanActions = {
  /**
   * 开始研究 - 批准当前计划
   */
  async startResearch(threadId: string, planId: string): Promise<void> {
    return sendHumanFeedback({
      threadId,
      planId,
      feedback: 'accepted'
    });
  },

  /**
   * 编辑计划 - 提交修改建议
   */
  async editPlan(threadId: string, planId: string, modifications: string): Promise<void> {
    return sendHumanFeedback({
      threadId,
      planId,
      feedback: 'edit_plan',
      message: modifications
    });
  },

  /**
   * 立即输出报告 - 跳过研究步骤
   */
  async skipToReport(threadId: string, planId: string): Promise<void> {
    return sendHumanFeedback({
      threadId,
      planId,
      feedback: 'skip_research'
    });
  },

  /**
   * 重新提问 - 取消当前流程
   */
  async reask(threadId: string, planId: string): Promise<void> {
    // 重新提问需要清理当前状态并跳转到首页
    const currentUrl = new URL(window.location.href);
    currentUrl.pathname = '/';
    currentUrl.searchParams.set('reask', '重新开始研究');
    window.location.href = currentUrl.toString();
  }
}; 