// SSE事件结构测试脚本
const fetch = require('node-fetch');
const crypto = require('crypto');
const fs = require('fs');

// 生成标准的UUID v4格式
function generateUUID() {
  return crypto.randomUUID();
}

// 创建日志文件名（带时间戳）
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFileName = `sse-test-${timestamp}.log`;

// 日志记录函数
function log(message) {
  console.log(message);
  fs.appendFileSync(logFileName, message + '\n');
}

async function testSSEEvents() {
  log('🔍 开始测试YADRA SSE事件结构...\n');
  
  const testQuestion = "人工智能在医疗健康领域的应用现状和未来发展趋势如何？请分析其优势、挑战和发展前景。";
  log(`📋 测试问题: ${testQuestion}\n`);
  log(`📝 日志文件: ${logFileName}\n`);
  
  try {
    const response = await fetch('http://localhost:8000/api/research/ask?stream=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: testQuestion,
        ask_type: "initial",
        frontend_uuid: generateUUID(),
        visitor_id: generateUUID(),
        config: {
          auto_accepted_plan: true,  // 修正字段名：使用下划线而不是驼峰
          max_plan_iterations: 2,    // 修正字段名
          max_step_num: 3,          // 修正字段名
          max_search_results: 5,   // 修正字段名
          enable_background_investigation: true,  // 修正字段名
          report_style: "academic", // 修正字段名
          enable_deep_thinking: true // 修正字段名
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    log('✅ 连接成功，开始接收SSE事件...\n');
    
    let eventCount = 0;
    const startTime = Date.now();
    const maxTestTime = 210 * 1000; // 210秒 = 210000毫秒

    let buffer = '';
    
    // Node.js环境下处理流
    response.body.on('data', (chunk) => {
      const currentTime = Date.now();
      if (currentTime - startTime > maxTestTime) {
        log(`\n⏰ 达到最大测试时间(210秒)，停止测试\n`);
        response.body.destroy();
        return;
      }

      buffer += chunk.toString();
      
      // 处理完整的事件行
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后一行（可能不完整）

      for (const line of lines) {
        if (line.trim() === '' || line.startsWith(':')) continue;
        
        if (line.startsWith('data: ')) {
          const eventData = line.slice(6); // 移除 'data: ' 前缀
          
          if (eventData === '[DONE]') {
            log('\n✅ 收到结束信号: [DONE]\n');
            return;
          }

          try {
            const parsedData = JSON.parse(eventData);
            eventCount++;
            
            const contentPreview = parsedData.content 
              ? (parsedData.content.length > 100 
                  ? parsedData.content.substring(0, 100) + '...' 
                  : parsedData.content)
              : '';
            
            log(`📨 事件 #${eventCount} [${parsedData.agent || 'unknown'}]:`);
            log(`   ID: ${parsedData.id || 'N/A'}`);
            log(`   时间戳: ${parsedData.timestamp || 'N/A'}`);
            log(`   执行ID: ${parsedData.execution_id || 'N/A'}`);
            log(`   线程ID: ${parsedData.thread_id || 'N/A'}`);
            log(`   内容长度: ${parsedData.content ? parsedData.content.length : 0} 字符`);
            if (contentPreview) {
              log(`   内容预览: ${contentPreview}`);
            }
            log('   ---');
          } catch (parseError) {
            log(`⚠️  解析事件数据失败: ${parseError.message}`);
            log(`   原始数据: ${eventData.substring(0, 200)}...`);
          }
        }
      }
    });

    response.body.on('end', () => {
      log('\n🔚 SSE流结束\n');
      log(`📊 总共接收到 ${eventCount} 个事件`);
      log(`⏱️  测试时长: ${Math.round((Date.now() - startTime) / 1000)}秒`);
      log(`📝 完整日志已保存到: ${logFileName}`);
    });

    response.body.on('error', (error) => {
      log('❌ 流读取错误:' + error);
    });

    // 设置超时保护
    setTimeout(() => {
      log(`\n⏰ 达到最大测试时间(210秒)，强制停止测试\n`);
      log(`📊 总共接收到 ${eventCount} 个事件`);
      log(`⏱️  测试时长: ${Math.round((Date.now() - startTime) / 1000)}秒`);
      log(`📝 完整日志已保存到: ${logFileName}`);
      if (!response.body.destroyed) {
        response.body.destroy();
      }
    }, maxTestTime);

  } catch (error) {
    log('❌ 测试过程中发生错误:' + error.message);
  }
}

// 运行测试
testSSEEvents(); 