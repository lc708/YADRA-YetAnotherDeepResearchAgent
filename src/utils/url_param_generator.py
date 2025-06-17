#!/usr/bin/env python3
"""
URL Parameter Generator for YADRA
生成SEO友好的URL参数，支持中文转拼音
"""

import re
import secrets
import string
from typing import List, Set
import jieba
from pypinyin import lazy_pinyin, Style


class URLParamGenerator:
    """URL参数生成器"""
    
    # 中文停用词
    CHINESE_STOPWORDS: Set[str] = {
        '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '什么', '如何', '怎么', '为什么', '哪里', '哪个', '多少', '几个', '什么时候', '怎样', '如果', '因为', '所以', '但是', '然后', '还有', '或者', '以及', '关于', '对于', '通过', '根据', '按照', '依据', '基于', '针对', '面向', '用于', '适用', '适合', '相关', '有关', '无关', '包括', '除了', '除外', '以外', '之外', '其中', '之一', '等等', '以上', '以下', '如下', '上述', '下述', '前述', '后述', '上面', '下面', '前面', '后面', '左边', '右边', '中间', '之间', '当中', '里面', '外面', '内部', '外部', '内在', '外在', '表面', '深层', '底层', '顶层', '高层', '低层', '各种', '各类', '多种', '多样', '不同', '相同', '类似', '相似', '差异', '区别', '对比', '比较', '分析', '研究', '探索', '发现', '找到', '获得', '得到', '取得', '实现', '达到', '完成', '做到', '能够', '可以', '应该', '需要', '必须', '一定', '肯定', '确实', '确定', '明确', '清楚', '详细', '具体', '准确', '精确', '正确', '错误', '问题', '答案', '解决', '方案', '方法', '方式', '途径', '手段', '工具', '技术', '技巧', '经验', '知识', '信息', '数据', '资料', '内容', '材料', '文档', '文件', '报告', '总结', '概述', '介绍', '说明', '描述', '解释', '定义', '概念', '原理', '理论', '实践', '应用', '使用', '操作', '处理', '管理', '控制', '调节', '调整', '改进', '优化', '提升', '增强', '加强', '减少', '降低', '提高', '增加', '扩大', '缩小', '扩展', '收缩', '开始', '结束', '停止', '继续', '进行', '执行', '运行', '工作', '任务', '项目', '计划', '目标', '目的', '意图', '想法', '思路', '思考', '考虑', '想要', '希望', '期望', '预期', '预测', '估计', '评估', '判断', '决定', '选择', '决策', '建议', '推荐', '意见', '观点', '看法', '态度', '立场', '角度', '方向', '趋势', '发展', '变化', '改变', '转变', '转换', '切换', '替换', '更换', '更新', '升级', '改版', '修改', '调整', '完善', '改善', '提升'
    }
    
    # 英文停用词
    ENGLISH_STOPWORDS: Set[str] = {
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 'with', 'what', 'when', 'where', 'who', 'why', 'how', 'which', 'this', 'these', 'those', 'can', 'could', 'should', 'would', 'may', 'might', 'must', 'shall', 'will', 'do', 'does', 'did', 'have', 'had', 'has', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'get', 'got', 'getting', 'make', 'made', 'making', 'take', 'took', 'taken', 'taking', 'come', 'came', 'coming', 'go', 'went', 'going', 'see', 'saw', 'seen', 'seeing', 'know', 'knew', 'known', 'knowing', 'think', 'thought', 'thinking', 'say', 'said', 'saying', 'tell', 'told', 'telling', 'give', 'gave', 'given', 'giving', 'find', 'found', 'finding', 'use', 'used', 'using', 'work', 'worked', 'working', 'call', 'called', 'calling', 'try', 'tried', 'trying', 'ask', 'asked', 'asking', 'need', 'needed', 'needing', 'want', 'wanted', 'wanting', 'look', 'looked', 'looking', 'seem', 'seemed', 'seeming', 'feel', 'felt', 'feeling', 'become', 'became', 'becoming', 'leave', 'left', 'leaving', 'put', 'putting', 'move', 'moved', 'moving', 'right', 'way', 'even', 'back', 'good', 'new', 'first', 'last', 'long', 'great', 'little', 'own', 'other', 'old', 'right', 'big', 'high', 'different', 'small', 'large', 'next', 'early', 'young', 'important', 'few', 'public', 'bad', 'same', 'able'
    }

    def __init__(self):
        """初始化生成器"""
        # 确保jieba初始化
        jieba.initialize()
    
    def extract_keywords(self, text: str, max_keywords: int = 5) -> List[str]:
        """
        从文本中提取关键词
        
        Args:
            text: 输入文本
            max_keywords: 最大关键词数量
            
        Returns:
            关键词列表
        """
        if not text or not text.strip():
            return []
        
        # 清理文本
        text = text.strip()
        
        # 分词处理
        words = []
        
        # 处理中文
        chinese_words = jieba.lcut(text)
        for word in chinese_words:
            word = word.strip()
            if (len(word) >= 2 and 
                word not in self.CHINESE_STOPWORDS and 
                not re.match(r'^[^\u4e00-\u9fff]*$', word)):  # 包含中文字符
                words.append(word)
        
        # 处理英文（如果有）
        english_words = re.findall(r'\b[a-zA-Z]{2,}\b', text.lower())
        for word in english_words:
            if word not in self.ENGLISH_STOPWORDS:
                words.append(word)
        
        # 去重并保持顺序
        seen = set()
        unique_words = []
        for word in words:
            if word not in seen:
                seen.add(word)
                unique_words.append(word)
        
        # 返回前N个关键词
        return unique_words[:max_keywords]
    
    def chinese_to_pinyin(self, text: str) -> str:
        """
        中文转拼音
        
        Args:
            text: 中文文本
            
        Returns:
            拼音字符串
        """
        if not text:
            return ""
        
        # 转换为拼音
        pinyin_list = lazy_pinyin(text, style=Style.NORMAL)
        
        # 处理拼音，移除特殊字符
        processed_pinyin = []
        for py in pinyin_list:
            # 只保留字母
            clean_py = re.sub(r'[^a-zA-Z]', '', py)
            if clean_py:
                processed_pinyin.append(clean_py.lower())
        
        return '-'.join(processed_pinyin)
    
    def generate_random_suffix(self, length: int = 8) -> str:
        """
        生成随机后缀
        
        Args:
            length: 后缀长度
            
        Returns:
            随机字符串
        """
        # 使用字母和数字，避免容易混淆的字符
        alphabet = string.ascii_letters + string.digits
        safe_chars = alphabet.replace('0', '').replace('O', '').replace('l', '').replace('I', '')
        
        return ''.join(secrets.choice(safe_chars) for _ in range(length))
    
    def generate_url_param(self, user_question: str, max_length: int = 50) -> str:
        """
        生成URL参数
        
        Args:
            user_question: 用户问题
            max_length: 最大长度
            
        Returns:
            URL参数字符串
        """
        if not user_question or not user_question.strip():
            # 如果没有问题，生成一个随机参数
            return f"question-{self.generate_random_suffix()}"
        
        # 1. 提取关键词
        keywords = self.extract_keywords(user_question, max_keywords=6)
        
        if not keywords:
            # 如果没有提取到关键词，使用默认
            return f"question-{self.generate_random_suffix()}"
        
        # 2. 处理关键词
        processed_keywords = []
        for keyword in keywords:
            if re.search(r'[\u4e00-\u9fff]', keyword):  # 包含中文
                # 中文转拼音
                pinyin = self.chinese_to_pinyin(keyword)
                if pinyin:
                    processed_keywords.append(pinyin)
            else:
                # 英文直接使用（小写化）
                clean_keyword = re.sub(r'[^a-zA-Z0-9]', '', keyword.lower())
                if clean_keyword:
                    processed_keywords.append(clean_keyword)
        
        # 3. 组合关键词
        if not processed_keywords:
            keywords_part = "question"
        else:
            keywords_part = "-".join(processed_keywords)
        
        # 4. 控制长度
        max_keywords_length = max_length - 10  # 为随机后缀预留空间
        if len(keywords_part) > max_keywords_length:
            # 截断关键词部分
            keywords_part = keywords_part[:max_keywords_length].rstrip('-')
        
        # 5. 生成随机后缀
        random_suffix = self.generate_random_suffix(8)
        
        # 6. 组合最终URL参数
        url_param = f"{keywords_part}-{random_suffix}"
        
        # 7. 最终清理和验证
        url_param = re.sub(r'-+', '-', url_param)  # 合并多个连字符
        url_param = url_param.strip('-')  # 移除首尾连字符
        
        # 确保不为空且不超过最大长度
        if not url_param or len(url_param) < 5:
            url_param = f"question-{self.generate_random_suffix()}"
        elif len(url_param) > max_length:
            url_param = url_param[:max_length].rstrip('-')
        
        return url_param
    
    def validate_url_param(self, url_param: str) -> bool:
        """
        验证URL参数的有效性
        
        Args:
            url_param: URL参数
            
        Returns:
            是否有效
        """
        if not url_param:
            return False
        
        # 检查长度
        if len(url_param) < 5 or len(url_param) > 100:
            return False
        
        # 检查字符（只允许字母、数字、连字符）
        if not re.match(r'^[a-zA-Z0-9-]+$', url_param):
            return False
        
        # 不能以连字符开始或结束
        if url_param.startswith('-') or url_param.endswith('-'):
            return False
        
        # 不能有连续的连字符
        if '--' in url_param:
            return False
        
        return True


# 全局实例
url_param_generator = URLParamGenerator()


def generate_url_param(user_question: str) -> str:
    """
    便捷函数：生成URL参数
    
    Args:
        user_question: 用户问题
        
    Returns:
        URL参数
    """
    return url_param_generator.generate_url_param(user_question)


def validate_url_param(url_param: str) -> bool:
    """
    便捷函数：验证URL参数
    
    Args:
        url_param: URL参数
        
    Returns:
        是否有效
    """
    return url_param_generator.validate_url_param(url_param)


if __name__ == "__main__":
    # 测试代码
    generator = URLParamGenerator()
    
    test_questions = [
        "如何学习人工智能？",
        "前端用户提交问题查询请求后的最佳实践",
        "What is the best way to learn Python programming?",
        "量子计算对密码学的影响分析",
        "How to implement a RESTful API with authentication",
        "深度学习在自然语言处理中的应用",
        "Bitcoin price analysis and market trends",
        "南京传统小笼包的制作工艺研究",
        "AI在医疗诊断中的应用前景",
        "Blockchain technology and its future applications"
    ]
    
    print("🧪 URL参数生成测试:")
    print("=" * 80)
    
    for question in test_questions:
        url_param = generator.generate_url_param(question)
        is_valid = generator.validate_url_param(url_param)
        
        print(f"问题: {question}")
        print(f"URL参数: {url_param}")
        print(f"有效性: {'✅' if is_valid else '❌'}")
        print(f"长度: {len(url_param)}")
        print("-" * 80) 