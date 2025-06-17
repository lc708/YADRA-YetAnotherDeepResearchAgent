"""
Checkpoint management API endpoints.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from langgraph.checkpoint.base import CheckpointTuple
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/threads", tags=["checkpoints"])


# 延迟导入以避免循环依赖
async def get_graph_instance():
    """Get the graph instance."""
    from src.server.app import get_graph_instance as _get_graph_instance
    return await _get_graph_instance()


class CheckpointInfo(BaseModel):
    """Checkpoint information model."""
    checkpoint_id: str
    thread_id: str
    timestamp: datetime
    metadata: Dict[str, Any]
    parent_checkpoint_id: Optional[str] = None


class StateUpdate(BaseModel):
    """State update request model."""
    updates: Dict[str, Any] = Field(..., description="State updates to apply")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Optional metadata")


class ResumeRequest(BaseModel):
    """Resume from checkpoint request model."""
    checkpoint_id: Optional[str] = Field(default=None, description="Specific checkpoint to resume from")
    inputs: Optional[Dict[str, Any]] = Field(default=None, description="Additional inputs for resumption")


class ThreadState(BaseModel):
    """Thread state response model."""
    thread_id: str
    checkpoint_id: str
    state: Dict[str, Any]
    metadata: Dict[str, Any]
    created_at: datetime
    parent_checkpoint_id: Optional[str] = None


@router.get("/{thread_id}/checkpoints", response_model=List[CheckpointInfo])
async def get_checkpoints(
    thread_id: str,
    limit: int = 50,
    before: Optional[str] = None
) -> List[CheckpointInfo]:
    """
    Get checkpoint history for a thread.
    
    Args:
        thread_id: Thread identifier
        limit: Maximum number of checkpoints to return
        before: Return checkpoints before this checkpoint_id
    
    Returns:
        List of checkpoint information
    """
    graph = await get_graph_instance()
    
    try:
        config = {"configurable": {"thread_id": thread_id}}
        if before:
            config["configurable"]["checkpoint_id"] = before
        
        checkpoints = []
        # Get checkpointer from graph
        checkpointer = graph.checkpointer
        
        async for checkpoint_tuple in checkpointer.alist(config):
            checkpoint_info = CheckpointInfo(
                checkpoint_id=checkpoint_tuple.config["configurable"]["checkpoint_id"],
                thread_id=thread_id,
                timestamp=checkpoint_tuple.checkpoint["ts"],
                metadata=checkpoint_tuple.metadata,
                parent_checkpoint_id=checkpoint_tuple.parent_config.get("configurable", {}).get("checkpoint_id") if checkpoint_tuple.parent_config else None
            )
            checkpoints.append(checkpoint_info)
            
            if len(checkpoints) >= limit:
                break
        
        return checkpoints
    except Exception as e:
        logger.error(f"Error getting checkpoints: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{thread_id}/state", response_model=ThreadState)
async def get_thread_state(
    thread_id: str,
    checkpoint_id: Optional[str] = None
) -> ThreadState:
    """
    Get current or specific checkpoint state for a thread.
    
    Args:
        thread_id: Thread identifier
        checkpoint_id: Optional specific checkpoint ID
    
    Returns:
        Thread state information
    """
    graph = await get_graph_instance()
    
    try:
        config = {"configurable": {"thread_id": thread_id}}
        if checkpoint_id:
            config["configurable"]["checkpoint_id"] = checkpoint_id
        
        # Get state snapshot
        state_snapshot = await graph.aget_state(config)
        
        if not state_snapshot or not state_snapshot.values:
            raise HTTPException(status_code=404, detail="Thread or checkpoint not found")
        
        # Extract checkpoint ID - handle different formats
        checkpoint_id_value = ""
        configurable = state_snapshot.config.get("configurable", {})
        
        # Try to get checkpoint_id first
        if "checkpoint_id" in configurable:
            checkpoint_id_value = configurable["checkpoint_id"]
        # PostgresSaver might use checkpoint_ns
        elif "checkpoint_ns" in configurable:
            checkpoint_id_value = configurable["checkpoint_ns"]
        else:
            # Fallback for other cases
            checkpoint_id_value = f"checkpoint-{thread_id}"
        
        # Extract parent checkpoint ID
        parent_checkpoint_id = None
        if state_snapshot.parent_config:
            parent_configurable = state_snapshot.parent_config.get("configurable", {})
            parent_checkpoint_id = parent_configurable.get("checkpoint_id")
        
        return ThreadState(
            thread_id=thread_id,
            checkpoint_id=checkpoint_id_value,
            state=state_snapshot.values,
            metadata=state_snapshot.metadata or {},
            created_at=state_snapshot.created_at if hasattr(state_snapshot, 'created_at') and state_snapshot.created_at else datetime.utcnow(),
            parent_checkpoint_id=parent_checkpoint_id
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting thread state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{thread_id}/update", response_model=ThreadState)
async def update_thread_state(
    thread_id: str,
    update_request: StateUpdate
) -> ThreadState:
    """
    Update thread state at current checkpoint.
    
    Args:
        thread_id: Thread identifier
        update_request: State updates to apply
    
    Returns:
        Updated thread state
    """
    graph = await get_graph_instance()
    
    try:
        config = {"configurable": {"thread_id": thread_id}}
        
        # Get current state
        current_state = await graph.aget_state(config)
        if not current_state:
            raise HTTPException(status_code=404, detail="Thread not found")
        
        # Apply updates
        await graph.aupdate_state(config, update_request.updates)
        
        # Get updated state
        updated_state = await graph.aget_state(config)
        
        return ThreadState(
            thread_id=thread_id,
            checkpoint_id=updated_state.config["configurable"]["checkpoint_id"],
            state=updated_state.values,
            metadata={
                **updated_state.metadata,
                "updated_at": datetime.utcnow().isoformat(),
                "update_metadata": update_request.metadata or {}
            },
            created_at=updated_state.created_at,
            parent_checkpoint_id=updated_state.parent_config.get("configurable", {}).get("checkpoint_id") if updated_state.parent_config else None
        )
    except Exception as e:
        logger.error(f"Error updating thread state: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{thread_id}/resume")
async def resume_thread_execution(
    thread_id: str,
    resume_request: ResumeRequest
):
    """
    Resume thread execution from a checkpoint.
    
    Args:
        thread_id: Thread identifier
        resume_request: Resume configuration
    
    Returns:
        Streaming response with execution results
    """
    from fastapi.responses import StreamingResponse
    import json
    
    graph = await get_graph_instance()
    
    config = {"configurable": {"thread_id": thread_id}}
    if resume_request.checkpoint_id:
        config["configurable"]["checkpoint_id"] = resume_request.checkpoint_id
    
    # Verify checkpoint exists
    state = await graph.aget_state(config)
    if not state:
        raise HTTPException(status_code=404, detail="Thread or checkpoint not found")
    
    async def generate():
        """Generate streaming response."""
        try:
            # Resume execution with optional inputs
            inputs = resume_request.inputs or {}
            
            async for event in graph.astream(inputs, config, stream_mode="values"):
                yield f"data: {json.dumps({'type': 'state_update', 'data': event})}\n\n"
                
            # Send completion event
            yield f"data: {json.dumps({'type': 'complete', 'thread_id': thread_id})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post("/{thread_id}/fork")
async def fork_thread(
    thread_id: str,
    checkpoint_id: Optional[str] = None,
    new_thread_id: Optional[str] = None
) -> ThreadState:
    """
    Fork a thread from a specific checkpoint.
    
    Args:
        thread_id: Source thread identifier
        checkpoint_id: Checkpoint to fork from (latest if not specified)
        new_thread_id: New thread ID (auto-generated if not provided)
    
    Returns:
        New thread state
    """
    import uuid
    
    graph = await get_graph_instance()
    
    try:
        # Get source checkpoint
        source_config = {"configurable": {"thread_id": thread_id}}
        if checkpoint_id:
            source_config["configurable"]["checkpoint_id"] = checkpoint_id
        
        source_state = await graph.aget_state(source_config)
        if not source_state:
            raise HTTPException(status_code=404, detail="Source thread or checkpoint not found")
        
        # Create new thread ID if not provided
        if not new_thread_id:
            new_thread_id = str(uuid.uuid4())
        
        # Create new thread with copied state
        new_config = {"configurable": {"thread_id": new_thread_id}}
        
        # Copy state to new thread
        await graph.aupdate_state(
            new_config,
            source_state.values,
            as_node="__start__"  # Start from beginning with copied state
        )
        
        # Get new thread state
        new_state = await graph.aget_state(new_config)
        
        return ThreadState(
            thread_id=new_thread_id,
            checkpoint_id=new_state.config["configurable"]["checkpoint_id"],
            state=new_state.values,
            metadata={
                **new_state.metadata,
                "forked_from_thread": thread_id,
                "forked_from_checkpoint": checkpoint_id or source_state.config["configurable"]["checkpoint_id"],
                "forked_at": datetime.utcnow().isoformat()
            },
            created_at=new_state.created_at,
            parent_checkpoint_id=None  # New thread has no parent
        )
    except Exception as e:
        logger.error(f"Error forking thread: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 