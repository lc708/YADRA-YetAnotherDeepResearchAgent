-- 查找具体的成功案例
SELECT 
    thread_id,
    checkpoint_id,
    checkpoint::text LIKE '%research_topic%' as has_research_topic,
    LENGTH(checkpoint::text) as checkpoint_size
FROM checkpoints 
WHERE thread_id IN ('thread_4122ff8323be4542', 'thread_dea57070ec2f485c')
ORDER BY checkpoint_id;

-- 找出最后一次成功写入 checkpoint 的时间
SELECT 
    MAX(checkpoint_id) as last_successful_checkpoint,
    COUNT(*) as total_checkpoints
FROM checkpoints;

-- 查看最后几个成功的 checkpoint 对应的 session
SELECT DISTINCT
    c.thread_id,
    sm.url_param,
    sm.initial_question,
    sm.created_at,
    c.checkpoint_id
FROM checkpoints c
JOIN session_mapping sm ON c.thread_id = sm.thread_id
ORDER BY c.checkpoint_id DESC
LIMIT 5;

-- 查看失败的 session（有 session 但没有 checkpoint）
SELECT 
    sm.thread_id,
    sm.url_param,
    sm.created_at,
    er.status,
    er.error_message
FROM session_mapping sm
LEFT JOIN checkpoints c ON sm.thread_id = c.thread_id
LEFT JOIN execution_record er ON sm.id = er.session_id
WHERE c.thread_id IS NULL
AND sm.created_at >= (
    SELECT MAX(sm2.created_at) 
    FROM session_mapping sm2 
    JOIN checkpoints c2 ON sm2.thread_id = c2.thread_id
) - INTERVAL '2 days'
ORDER BY sm.created_at DESC; 