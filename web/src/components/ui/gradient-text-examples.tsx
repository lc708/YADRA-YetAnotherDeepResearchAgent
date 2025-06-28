import React from "react";
import { 
  GradientText,
  PrimaryGradientText,
  SuccessGradientText,
  WarningGradientText,
  DangerGradientText,
  PurpleGradientText,
  RainbowGradientText,
  SubtleGradientText
} from "./gradient-text";

/**
 * 渐变文字组件使用示例
 * 
 * 基于YADRA设计风格规范的渐变文字效果
 * 在浅色背景下效果最佳
 */
export const GradientTextExamples = () => {
  return (
    <div className="p-8 bg-white space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">渐变文字效果展示</h2>
        
        {/* 基础用法 */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-700">基础主题</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">品牌蓝:</span>
              <PrimaryGradientText className="text-2xl font-bold">
                YADRA 深度研究助手
              </PrimaryGradientText>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">成功绿:</span>
              <SuccessGradientText className="text-2xl font-bold">
                研究任务完成
              </SuccessGradientText>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">警告橙:</span>
              <WarningGradientText className="text-2xl font-bold">
                需要人工确认
              </WarningGradientText>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">错误红:</span>
              <DangerGradientText className="text-2xl font-bold">
                连接失败
              </DangerGradientText>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">紫色:</span>
              <PurpleGradientText className="text-2xl font-bold">
                AI 推理模式
              </PurpleGradientText>
            </div>
          </div>
        </div>

        {/* 强度变化 */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-700">强度变化</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">轻度:</span>
              <GradientText theme="primary" intensity="light" className="text-2xl font-bold">
                Hi {"{用户名}"}
              </GradientText>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">中度:</span>
              <GradientText theme="primary" intensity="medium" className="text-2xl font-bold">
                Hi {"{用户名}"}
              </GradientText>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">强度:</span>
              <GradientText theme="primary" intensity="strong" className="text-2xl font-bold">
                Hi {"{用户名}"}
              </GradientText>
            </div>
          </div>
        </div>

        {/* 方向变化 */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-700">渐变方向</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <GradientText theme="primary" direction="to-r" className="text-xl font-bold block">
                从左到右 →
              </GradientText>
              <GradientText theme="success" direction="to-br" className="text-xl font-bold block">
                从左上到右下 ↘
              </GradientText>
              <GradientText theme="warning" direction="to-b" className="text-xl font-bold block">
                从上到下 ↓
              </GradientText>
              <GradientText theme="purple" direction="to-bl" className="text-xl font-bold block">
                从右上到左下 ↙
              </GradientText>
            </div>
            <div className="space-y-2">
              <GradientText theme="danger" direction="to-l" className="text-xl font-bold block">
                从右到左 ←
              </GradientText>
              <GradientText theme="primary" direction="to-tl" className="text-xl font-bold block">
                从右下到左上 ↖
              </GradientText>
              <GradientText theme="success" direction="to-t" className="text-xl font-bold block">
                从下到上 ↑
              </GradientText>
              <GradientText theme="warning" direction="to-tr" className="text-xl font-bold block">
                从左下到右上 ↗
              </GradientText>
            </div>
          </div>
        </div>

        {/* 特殊效果 */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-700">特殊效果</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">彩虹:</span>
              <RainbowGradientText className="text-2xl font-bold">
                多彩世界，无限可能
              </RainbowGradientText>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">微妙:</span>
              <SubtleGradientText className="text-2xl font-bold">
                低调奢华，内敛深沉
              </SubtleGradientText>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-16 text-sm text-gray-500">动画:</span>
              <PrimaryGradientText animated className="text-2xl font-bold">
                脉动效果
              </PrimaryGradientText>
            </div>
          </div>
        </div>

        {/* 实际应用场景 */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-700">实际应用场景</h3>
          <div className="space-y-4 p-6 bg-gray-50 rounded-lg">
            <div className="text-center">
              <PrimaryGradientText className="text-4xl font-bold">
                Hi 张三
              </PrimaryGradientText>
              <p className="text-gray-600 mt-2">今天需要我做点什么？</p>
            </div>
            
            <div className="border-t pt-4">
              <SuccessGradientText className="text-lg font-semibold">
                ✅ 研究报告已生成
              </SuccessGradientText>
              <p className="text-gray-600 text-sm mt-1">关于"量子计算对密码学的影响"的深度分析</p>
            </div>
            
            <div className="border-t pt-4">
              <WarningGradientText className="text-lg font-semibold">
                ⚠️ 等待用户反馈
              </WarningGradientText>
              <p className="text-gray-600 text-sm mt-1">研究计划需要您的确认才能继续</p>
            </div>
            
            <div className="border-t pt-4">
              <PurpleGradientText className="text-lg font-semibold">
                🤖 AI 推理中...
              </PurpleGradientText>
              <p className="text-gray-600 text-sm mt-1">正在分析最新的学术论文</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 