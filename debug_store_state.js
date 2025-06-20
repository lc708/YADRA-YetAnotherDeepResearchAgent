// 在浏览器控制台执行这些代码来调试store状态

// 1. 检查当前线程ID
console.log("=== 当前线程状态 ===");
const store = window.__ZUSTAND_STORE__;
if (store) {
  const state = store.getState();
  console.log("当前线程ID:", state.currentThreadId);
  console.log("当前URL参数:", state.currentUrlParam);
  console.log("URL参数映射:", state.urlParamToThreadId);
  
  // 2. 检查线程数据
  if (state.currentThreadId) {
    const thread = state.threads.get(state.currentThreadId);
    console.log("当前线程数据:", thread);
    
    if (thread) {
      console.log("线程消息数量:", thread.messages.length);
      console.log("最新消息:", thread.messages[thread.messages.length - 1]);
      console.log("当前interrupt:", thread.ui.currentInterrupt);
    }
  }
  
  // 3. 检查所有线程
  console.log("所有线程:", Array.from(state.threads.keys()));
  state.threads.forEach((thread, threadId) => {
    console.log(`线程 ${threadId}:`, {
      消息数量: thread.messages.length,
      interrupt状态: thread.ui.currentInterrupt
    });
  });
} else {
  console.log("未找到Zustand store");
}

// 4. 检查页面URL参数
const urlParams = new URLSearchParams(window.location.search);
const urlParamId = urlParams.get('id');
console.log("页面URL参数:", urlParamId);

// 5. 手动调用getCurrentInterrupt测试
if (store && store.getState().currentThreadId) {
  const currentInterrupt = store.getState().getCurrentInterrupt(store.getState().currentThreadId);
  console.log("手动获取interrupt:", currentInterrupt);
} 