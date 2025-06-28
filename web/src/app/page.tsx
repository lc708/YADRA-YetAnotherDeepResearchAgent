// Copyright (c) 2025 YADRA

"use client";

import React from 'react';
import { 
  PrimaryGradientText,
  SuccessGradientText, 
  WarningGradientText,
  DangerGradientText,
  PurpleGradientText,
  RainbowGradientText,
  SubtleGradientText,
  GradientText
} from '~/components/ui/gradient-text';

export default function HomePage() {
  return (
    <div className="min-h-full bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <Hero />
        <SearchSection />
        <CaseShowcase />
      </div>
    </div>
  );
}

// Hero Component
const Hero = () => {
  return (
    <section className="pt-20 pb-16 text-center">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight animate-fade-in">
        <PrimaryGradientText intensity='strong'>YADRA</PrimaryGradientText>深度研究Agent
        </h1>
                  <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed animate-fade-in-delay">
            <RainbowGradientText animated={true}>输入研究主题 - 确认执行计划 - 等待3-5分钟 - 实时在线编辑 - 下载复制保存</RainbowGradientText>
          </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-delay-2">
          <button 
            onClick={() => window.location.href = '/workspace'}
            className="px-8 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all duration-300 shadow-sm hover:shadow-md hover:scale-105 transform"
          >
            登录后马上开始体验
          </button>
          <button className="px-8 py-3 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-secondary/80 transition-all duration-300 border border-border hover:scale-105 transform">
            了解更多
          </button>
        </div>
      </div>
    </section>
  );
};

// Search Section Component
const SearchSection = () => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // 移除跳转功能，保持纯静态
    if (searchQuery.trim()) {
      console.log('搜索查询:', searchQuery);
    }
  };

  return (
    <section onClick={() => window.location.href = '/workspace'} className="py-16 bg-card rounded-2xl shadow-sm border border-border mb-20 animate-slide-up">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <span className="w-6 h-6 text-primary animate-pulse">✨</span>
            <span className="text-lg font-semibold text-card-foreground">请登录/注册后使用</span>
          </div>
          <p className="text-muted-foreground">
           <SubtleGradientText intensity='light'>特别感谢开源项目 DeerFlow / local-deep-researcher / OpenDeepResearch 的提示词模板，帮助良多</SubtleGradientText>
          </p>
        </div>
        
        <form onSubmit={handleSearch} className="relative">
          <div className="relative">
            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder=""
              className="w-full pl-12 pr-32 py-4 text-base border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-all duration-200 bg-muted hover:bg-card focus:scale-105 transform"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 px-6 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 hover:scale-105"
              disabled={!searchQuery.trim()}
            >
              搜索
            </button>
          </div>
        </form>

        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {['什么是数据流通利用基础设施', '过去5年的欧洲手机市场情况', '吴恩达人工智能课程'].map((tag, index) => (
            <button
              key={tag}
              onClick={() => setSearchQuery(tag)}
              className="px-4 py-2 text-sm text-muted-foreground bg-muted rounded-full hover:bg-accent hover:text-accent-foreground transition-all duration-200 hover:scale-105 transform animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

// Case Card Component
const CaseCard: React.FC<{
  title: string;
  description: string;
  image: string;
  category: string;
  tags: string[];
}> = ({ title, description, image, category, tags }) => {
  return (
    <div className="group bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-2 animate-slide-up">
      <div className="relative overflow-hidden">
        <img 
          src={image} 
          alt={title}
          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-card/90 backdrop-blur-sm text-sm font-medium text-card-foreground rounded-full">
            {category}
          </span>
        </div>
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:rotate-45">
          <div className="w-8 h-8 bg-card/90 backdrop-blur-sm rounded-full flex items-center justify-center">
            <span className="text-card-foreground">↗</span>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="text-lg font-semibold text-card-foreground mb-3 group-hover:text-primary transition-colors duration-200">
          {title}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
          {description}
        </p>
        
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <span 
              key={index}
              className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded-md hover:bg-accent hover:text-primary transition-colors duration-200"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// Case Showcase Component
const CaseShowcase = () => {
  const cases = [
    {
      title: "数据流通利用基础设施研究报告",
      description: "具体定义、核心构成、应用实践、发展趋势及其深远影响。",
      image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400&h=300&fit=crop",
      category: "研究报告",
      tags: ["数据要素", "隐私计算", "公共数据"]
    },
    {
      title: "小米YU7的上市新闻",
      description: "小米YU7的定价、性能、市场前景和影响",
      image: "https://cdn.8mediatech.com/gambar/97114574785-newscover_2025_5_28_1748414422264-zg3e4i.jpeg",
      category: "新闻稿件",
      tags: ["智能驾驶", "新能源汽车", "发布会"]
    },
    {
      title: "沙县小吃和兰州拉面",
      description: "揭秘！沙县vs兰州拉面，打工人YYDS到底是谁？",
      image: "https://images.unsplash.com/photo-1704034740076-d3c0cdc991a7?w=400&h=300&fit=crop&q=80",
      category: "社媒文案",
      tags: ["小红书", "国民美食", "冷知识"]
    },
    {
      title: "AI Agent发展报告",
      description: "全面分析过去一年（2024年6月至2025年6月）AI Agent领域的技术发展、市场动态及代表性事件",
      image: "https://images.unsplash.com/photo-1738641928061-e68c5e8e2f2b?w=400&h=300&fit=crop",
      category: "科普博客",
      tags: ["人工智能", "智能体", "MCP"]
    },
    {
      title: "气候变化对全球农业影响的研究报告",
      description: "气候变化对全球农业的影响：影响范围、影响机制、未来研究方向",
      image: "https://images.unsplash.com/photo-1744477083960-2e2e3e6d8223?w=400&h=300&fit=crop",
      category: "研究报告",
      tags: ["气候变化", "粮食安全", "农业"]
    },
    {
      title: "墨尔本中餐厅发展报告2020-2025",
      description: "墨尔本作为澳大利亚多元文化中心，其中餐厅业态在最近5年间经历了显著的结构性变革",
      image: "https://images.unsplash.com/photo-1721222778575-c64b9299ff2d?w=400&h=300&fit=crop",
      category: "科普博客",
      tags: ["市场分析", "消费者", "餐饮业"]
    }
  ];

  return (
    <section className="py-20">
      <div className="text-center mb-16 animate-fade-in">
        <h2 className="text-3xl font-bold text-foreground mb-4">
          报告展示
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          YADRA在报告、文章、新闻稿和社媒文案创作方面的实例
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {cases.map((caseItem, index) => (
          <div
            key={index}
            className="animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CaseCard
              title={caseItem.title}
              description={caseItem.description}
              image={caseItem.image}
              category={caseItem.category}
              tags={caseItem.tags}
            />
          </div>
        ))}
      </div>

      <div className="text-center mt-12 animate-fade-in-delay">
        <button className="px-8 py-3 border border-border text-muted-foreground font-medium rounded-lg hover:bg-accent transition-all duration-300 hover:scale-105 transform">
          查看更多案例
        </button>
      </div>
    </section>
  );
};
