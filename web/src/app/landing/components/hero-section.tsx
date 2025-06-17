"use client";

import { GithubFilled } from "@ant-design/icons";
import { ChevronRight, Sparkles, FileText, Database, Clock } from "lucide-react";
import Link from "next/link";
import React from "react";
import { motion } from "framer-motion";

import { Button } from "~/components/ui/button";
import { HeroInput } from "~/components/yadra/hero-input";
import { DEFAULT_QUESTIONS } from "~/config/questions";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-black px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent"></div>
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]"></div>
      
      <div className="relative z-10 flex w-full max-w-6xl flex-col items-center justify-center gap-8 text-center sm:gap-12">
        <div className="space-y-6 sm:space-y-8">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 backdrop-blur-sm">
            <Sparkles className="mr-2 h-4 w-4" />
            <span>全新深度研究体验</span>
          </div>
          
          <h1 className="text-4xl font-bold leading-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
            你想要研究什么？
          </h1>
          
          <p className="mx-auto max-w-2xl text-lg text-gray-300 sm:text-xl md:text-2xl">
            通过AI对话创建深度研究报告。
            <br className="hidden sm:block" />
            每个过程步骤都可追溯，结果实时呈现。
          </p>
        </div>

        <div className="w-full max-w-4xl space-y-8">
          <HeroInput />
          
          {/* 示例问题网格 */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-center"
            >
              <p className="text-sm text-gray-400 mb-4">或者选择以下热门研究主题：</p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-w-5xl mx-auto">
              {DEFAULT_QUESTIONS.slice(0, 6).map((question, index) => (
                <motion.div
                  key={question}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1, duration: 0.5 }}
                  className="group cursor-pointer"
                  onClick={() => {
                    // 触发HeroInput的发送逻辑
                    const event = new CustomEvent('heroQuestionSelect', { 
                      detail: { question } 
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:scale-105 active:scale-95">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                    <div className="relative z-10">
                      <p className="text-sm text-gray-300 group-hover:text-white transition-colors duration-300 overflow-hidden text-ellipsis" style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {question}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-400 sm:gap-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-400" />
              <span>3秒响应</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-400" />
              <span>全程可追溯</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-400" />
              <span>私有数据优先</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <div className="text-center text-sm text-gray-500">
            或者导入自
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              asChild
            >
              <Link href="https://github.com/lc708/YADRA-YetAnotherDeepResearchAgent" target="_blank">
                <GithubFilled className="mr-2 h-4 w-4" />
                GitHub
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              asChild
            >
              <Link href="https://github.com/lc708/YADRA-YetAnotherDeepResearchAgent/blob/main/README.md" target="_blank">
                <FileText className="mr-2 h-4 w-4" />
                文档
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
          <span>构建移动应用</span>
          <span>•</span>
          <span>开始博客</span>
          <span>•</span>
          <span>创建文档站点</span>
          <span>•</span>
          <span>制作仪表板</span>
        </div>

        <div className="mt-12 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            asChild
          >
            <Link href="/chat">
              传统聊天界面 <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            asChild
          >
            <Link href="/test-duplicate">
              防重复发送测试 <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
            asChild
          >
            <Link
              href="https://github.com/lc708/YADRA-YetAnotherDeepResearchAgent"
              target="_blank"
            >
              <GithubFilled className="mr-2 h-4 w-4" />
              GitHub
            </Link>
          </Button>
        </div>
      </div>

      <div className="absolute bottom-6 text-xs text-gray-500">
        <p>YADRA - Yet Another Deep Research Agent</p>
      </div>
    </section>
  );
}
