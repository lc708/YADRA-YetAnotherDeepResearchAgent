-- 1. 查看最近的 checkpoints 写入
SELECT 
    thread_id,
    checkpoint_id,
    created_at,
    CASE 
        WHEN checkpoint::text LIKE '%research_topic%' THEN 
            substring(checkpoint::text from '"research_topic":\s*"([^"]+)"')
        ELSE 'N/A'
    END as research_topic
FROM checkpoints 
ORDER BY checkpoint_id DESC 
LIMIT 10;

-- 2. 查看最近的 session_mapping 创建
SELECT 
    thread_id,
    url_param,
    initial_question,
    status,
    created_at
FROM session_mapping 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. 对比分析：找出有 session 但没有 checkpoint 的记录
SELECT 
    sm.thread_id,
    sm.url_param,
    sm.initial_question,
    sm.created_at as session_created,
    CASE 
        WHEN c.thread_id IS NULL THEN 'NO_CHECKPOINT'
        ELSE 'HAS_CHECKPOINT'
    END as checkpoint_status
FROM session_mapping sm
LEFT JOIN checkpoints c ON sm.thread_id = c.thread_id
WHERE sm.created_at >= NOW() - INTERVAL '7 days'
ORDER BY sm.created_at DESC;

-- 4. 查看最近的 execution_record 状态
SELECT 
    er.execution_id,
    sm.thread_id,
    sm.url_param,
    er.status,
    er.created_at,
    er.error_message
FROM execution_record er
JOIN session_mapping sm ON er.session_id = sm.id
WHERE er.created_at >= NOW() - INTERVAL '3 days'
ORDER BY er.created_at DESC
LIMIT 15;

-- 5. 统计分析：按日期统计成功率
SELECT 
    DATE(sm.created_at) as date,
    COUNT(sm.id) as total_sessions,
    COUNT(c.thread_id) as sessions_with_checkpoints,
    ROUND(COUNT(c.thread_id)::float / COUNT(sm.id) * 100, 2) as success_rate
FROM session_mapping sm
LEFT JOIN checkpoints c ON sm.thread_id = c.thread_id
WHERE sm.created_at >= NOW() - INTERVAL '14 days'
GROUP BY DATE(sm.created_at)
ORDER BY date DESC; 