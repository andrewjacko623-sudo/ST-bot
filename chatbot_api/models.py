from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List


class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    message: str = Field(..., description="The message to send to Grok", min_length=1)
    temperature: Optional[float] = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Sampling temperature (0.0 to 2.0)"
    )
    max_tokens: Optional[int] = Field(
        default=1000,
        ge=1,
        le=32000,
        description="Maximum number of tokens to generate"
    )
    system_prompt: Optional[str] = Field(
        default=None,
        description="System prompt to set the assistant's behavior"
    )


class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    response: str = Field(..., description="Grok's response message")
    model: str = Field(..., description="Model used for the response")
    usage: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Token usage information"
    )
    media_urls: Optional[List[str]] = Field(
        default=None,
        description="URLs to media (images/videos) to display with the response"
    )