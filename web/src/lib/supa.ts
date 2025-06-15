import { createClient } from "@supabase/supabase-js";

import { env } from "~/env";

export const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
);

export type ArtifactType = "process" | "result";

/**
 * 支持的MIME类型
 * 扩展设计：支持多种结果输出格式
 */
export type ArtifactMimeType = 
  // Markdown类型
  | "text/markdown"
  | "text/markdown+report"      // 研究报告
  | "text/markdown+summary"     // 摘要文档
  | "text/markdown+analysis"    // 分析文档
  
  // HTML类型  
  | "text/html"
  | "text/html+report"          // HTML格式报告
  | "text/html+presentation"    // 演示文档
  
  // 代码类型
  | "text/plain+code"           // 代码片段
  | "application/json+data"     // 数据文件
  | "text/csv+data"             // CSV数据
  
  // 媒体类型
  | "audio/mpeg+podcast"        // 播客音频
  | "application/pdf+document"  // PDF文档
  
  // 通用类型
  | "text/plain"                // 纯文本
  | "application/json";         // JSON数据

/**
 * Artifact接口
 * 扩展设计：支持多个结果产出和各种类型
 */
export interface Artifact {
  id: string;
  trace_id: string;
  node_name: string;
  type: ArtifactType;
  mime: ArtifactMimeType | string; // 允许自定义MIME类型
  summary?: string;
  payload_url?: string;           // 内容数据或外部URL
  created_at: string;
  user_id: string;
  
  // 扩展字段：支持更丰富的元数据
  metadata?: {
    // 结果分组：同一次执行可能产生多个结果
    batch_id?: string;            // 批次ID，用于关联同时产生的多个结果
    sequence?: number;            // 在批次中的序号
    
    // 内容元数据
    word_count?: number;          // 字数统计
    file_size?: number;           // 文件大小
    language?: string;            // 内容语言
    
    // 处理状态
    processing_status?: "pending" | "completed" | "failed";
    error_message?: string;       // 错误信息
    
    // 关联信息
    source_message_id?: string;   // 来源消息ID
    related_artifact_ids?: string[]; // 相关工件ID
  };
}

/**
 * 工件类型判断工具函数
 */
export const ArtifactUtils = {
  // 判断是否为报告类型
  isReport: (artifact: Artifact): boolean => {
    return artifact.type === "result" && (
      artifact.mime.includes("markdown") || 
      artifact.mime.includes("html") ||
      artifact.mime.includes("report")
    );
  },
  
  // 判断是否为代码类型
  isCode: (artifact: Artifact): boolean => {
    return artifact.mime.includes("code") || 
           artifact.mime === "application/json+data";
  },
  
  // 判断是否为媒体类型
  isMedia: (artifact: Artifact): boolean => {
    return artifact.mime.includes("audio/") || 
           artifact.mime.includes("video/") ||
           artifact.mime.includes("image/");
  },
  
  // 获取文件扩展名
  getFileExtension: (artifact: Artifact): string => {
    const mimeToExt: Record<string, string> = {
      "text/markdown": "md",
      "text/html": "html", 
      "text/plain": "txt",
      "application/json": "json",
      "text/csv+data": "csv",
      "audio/mpeg+podcast": "mp3",
      "application/pdf+document": "pdf",
    };
    
    // 精确匹配
    if (mimeToExt[artifact.mime]) {
      return mimeToExt[artifact.mime]!;
    }
    
    // 模糊匹配
    if (artifact.mime.includes("markdown")) return "md";
    if (artifact.mime.includes("html")) return "html";
    if (artifact.mime.includes("json")) return "json";
    if (artifact.mime.includes("csv")) return "csv";
    if (artifact.mime.includes("code")) return "txt";
    
    return "txt"; // 默认
  },
  
  // 获取显示名称
  getDisplayName: (artifact: Artifact): string => {
    if (artifact.mime.includes("report")) return "研究报告";
    if (artifact.mime.includes("summary")) return "摘要文档";
    if (artifact.mime.includes("analysis")) return "分析文档";
    if (artifact.mime.includes("code")) return "代码片段";
    if (artifact.mime.includes("data")) return "数据文件";
    if (artifact.mime.includes("podcast")) return "播客音频";
    if (artifact.mime.includes("presentation")) return "演示文档";
    
    return artifact.node_name || "工件";
  }
};

export interface Database {
  public: {
    Tables: {
      artifacts: {
        Row: Artifact;
        Insert: Omit<Artifact, "id" | "created_at">;
        Update: Partial<Omit<Artifact, "id" | "created_at">>;
      };
    };
  };
}
