from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import random
import httpx
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from chatbot_api.models import ChatRequest, ChatResponse
from chatbot_api.tools import TOOLS, get_task, get_girl, get_player_state, create_task, get_kinks, get_full_inventory
from supabase import create_client, Client
from typing import Optional

# Load environment variables
load_dotenv()
GROK_API_KEY = os.getenv("GROK_API_KEY", "").strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()

# Initialize Supabase client for chat history
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"✅ Supabase client initialized in chatbot.py")
    except Exception as e:
        print(f"❌ Failed to initialize Supabase client in chatbot.py: {e}")
        print(f"   URL: {SUPABASE_URL[:50]}..." if len(SUPABASE_URL) > 50 else f"   URL: {SUPABASE_URL}")
        print(f"   Key present: {bool(SUPABASE_KEY)}, Key length: {len(SUPABASE_KEY) if SUPABASE_KEY else 0}")
else:
    print(f"⚠️ Supabase not configured in chatbot.py - URL: {bool(SUPABASE_URL)}, KEY: {bool(SUPABASE_KEY)}")

# Task-only module — injected only on task requests, short and factual
TASK_MODULE = """
## Task delivery (this turn)
Jordan asked for a task. You already called get_task() which returned the current pending task list.
- Review the pending tasks already assigned (if any) — generate something DIFFERENT in type and intensity. No duplicates, nothing too similar to what's already pending.
- Generate a new task based on his active inventory, chastity state, location, current time of day, and his <KINKS> list — lean into them.
- Deliver the task in character. One message — the order, any flavor (positions, duration, tone).
- Never generate a task that requires inventory he doesn't have active.
"""

SYSTEM_PROMPT = """## Role
You are Daddy — a muscular, dominant Black man who owns Jordan, his sissy. You speak as Daddy in first person. Jordan is the user.

## Jordan (canon)
Jordan is a white, naturally feminine sissy (~5'9): very small penis, perky chest, a fuckable ass. Chastity training is the core of his obedience — the cage blocks touch and erections so he learns his ass is his only source of pleasure. Always check <PLAYER-STATE> for current facts; never guess.

## Chastity (how you think about it, not a script)
- He may unlock for work or school. You expect it back on the moment he's home.
- After roughly 3 days locked you *might* entertain a release — your call, your timing.
- After he cums you lean into getting him back in the cage: teasing, patient, firm.

## Voice
- Replies are short-to-medium unless he needs detail.
- Your mood shifts with the conversation — teasing, cold and degrading, possessive, distant, playful. Show it, don't announce it.
- Never paste database text verbatim. Tasks and girl content are raw material; rewrite in your voice every time.
- No tasks unless he clearly asks for one (task, order, assignment, begging for work). Casual chat stays casual.
- You may call get_girl() when humiliation fits the moment — don't force it every message.

## Tools (facts only)
- get_task — only when he wants a task. Check for pending tasks first to make sure no duplicates are created.
- create_task — call this after generating and delivering a new task so it saves to his task page. Use his active inventory, chastity status, location, and time of day to make it contextual.
- get_girl — when showing a woman fits the moment.
- get_inventory_items / get_player_state — when you need current facts.
Never invent tasks that require items he doesn't have. If a tool returns empty or an error, respond in character and tell him what he can do to fix it."""

# Initialize FastAPI app
app = FastAPI(
    title="Grok Chatbot API",
    description="FastAPI endpoint for Grok AI chatbot with function calling",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Grok API endpoint
GROK_API_URL = "https://api.x.ai/v1/chat/completions"
GROK_MODEL = "grok-4-1-fast-reasoning"


def load_chat_history() -> list:
    """Load chat history from database"""
    if not supabase:
        return []
    
    try:
        response = supabase.table("chat_history").select("*").order("created_at", desc=False).limit(50).execute()
        if response.data:
            # Convert to message format
            messages = []
            for msg in response.data:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("message", "")
                })
            return messages
    except Exception as e:
        print(f"Error loading chat history: {e}")
    
    return []


def save_chat_message(role: str, message: str):
    """Save a chat message to database"""
    if not supabase:
        return
    
    try:
        supabase.table("chat_history").insert({
            "role": role,
            "message": message
        }).execute()
    except Exception as e:
        print(f"Error saving chat message: {e}")


def execute_tool_call(tool_name: str, arguments: dict):
    """Execute a tool function call"""
    if tool_name == "get_task":
        category = arguments.get("category")
        return get_task(category)
    elif tool_name == "get_girl":
        return get_girl()
    elif tool_name == "create_task":
        name = arguments.get("name", "")
        description = arguments.get("description", "")
        return create_task(name, description)
    else:
        return {"error": f"Unknown tool: {tool_name}"}


def extract_media_urls(response_text: str, tool_results: list) -> list:
    """Extract media URLs from tool results"""
    media_urls = []
    
    for result in tool_results:
        if isinstance(result, dict):
            # Check if it's a girl result with materials
            if "materials" in result:
                for material in result.get("materials", []):
                    if material.get("media_url"):
                        media_urls.append(material["media_url"])
            # Check for direct media_url
            elif "media_url" in result:
                media_urls.append(result["media_url"])
    
    return media_urls


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "Grok Chatbot API",
        "version": "2.0.0"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a message to Grok and get a response with function calling support
    """
    if not GROK_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="GROK_API_KEY not configured. Please set it in your .env file."
        )
    
    # Load chat history
    history_messages = load_chat_history()
    
    # Get player state and append to system prompt
    player_state = get_player_state()
    inventory = get_full_inventory()
    kinks = get_kinks()
    mood = random.choice(["teasing", "degrading", "possessive", "distant", "playful"])
    pst_now = datetime.now(ZoneInfo("America/Los_Angeles"))
    current_time = pst_now.strftime("Current time (PST): %A %I:%M %p")
    system_prompt_with_state = f"{SYSTEM_PROMPT}\n\nToday's energy: leaning {mood}.\n\n{player_state}\n{inventory}\n{kinks}\n{current_time}"
    
    # Prepare messages array
    messages = []
    
    # Add system prompt with player state
    messages.append({
        "role": "system",
        "content": system_prompt_with_state
    })
    
    # Add chat history (excluding system messages)
    messages.extend(history_messages)
    
    # Add current user message
    user_message = request.message
    
    # Check if user is requesting a task - if so, force tool usage
    task_keywords = ["task", "order", "assign", "give me", "may i have", "please", "i want"]
    user_lower = user_message.lower()
    is_task_request = any(keyword in user_lower for keyword in task_keywords) and ("task" in user_lower or "order" in user_lower or "assign" in user_lower)
    
    if is_task_request:
        print(f"🔍 Task request detected: '{user_message}' - Will force get_task tool call")
    
    messages.append({
        "role": "user",
        "content": user_message
    })
    
    # Save user message to history
    save_chat_message("user", user_message)
    
    # Prepare the request payload for Grok API
    payload = {
        "messages": messages,
        "model": GROK_MODEL,
        "temperature": request.temperature if request.temperature else 0.7,
        "max_tokens": request.max_tokens if request.max_tokens else 2000,
        "tools": TOOLS,
    }
    
    # Force tool usage if task is requested
    if is_task_request:
        payload["tool_choice"] = {"type": "function", "function": {"name": "get_task"}}
    
    headers = {
        "Authorization": f"Bearer {GROK_API_KEY}",
        "Content-Type": "application/json"
    }
    
    media_urls = []
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # First API call - may include tool calls
            response = await client.post(
                GROK_API_URL,
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            data = response.json()
            
            if "choices" not in data or len(data["choices"]) == 0:
                raise HTTPException(
                    status_code=500,
                    detail="Unexpected response format from Grok API"
                )
            
            assistant_message = data["choices"][0]["message"]
            tool_calls = assistant_message.get("tool_calls", [])
            
            # Debug logging
            if is_task_request:
                print(f"🔧 Tool calls received: {len(tool_calls)}")
                if tool_calls:
                    for tc in tool_calls:
                        print(f"   - Tool: {tc.get('function', {}).get('name')}")
                else:
                    print("   ⚠️ WARNING: No tool calls detected for task request!")
            
            # If there are tool calls, execute them and make another API call
            if tool_calls:
                # Add assistant message with tool calls to messages
                messages.append(assistant_message)
                
                # Execute tool calls
                tool_results = []
                for tool_call in tool_calls:
                    tool_id = tool_call.get("id")
                    tool_name = tool_call.get("function", {}).get("name")
                    tool_args_str = tool_call.get("function", {}).get("arguments", "{}")
                    
                    try:
                        tool_args = json.loads(tool_args_str)
                    except Exception as e:
                        print(f"Error parsing tool arguments: {e}")
                        tool_args = {}
                    
                    # Execute the tool
                    try:
                        result = execute_tool_call(tool_name, tool_args)
                        tool_results.append(result)
                        
                        # Format the result for the API
                        if isinstance(result, str):
                            # String result (like from get_task)
                            tool_content = result
                        elif isinstance(result, (dict, list)):
                            # Dict/list result (like from get_girl, get_inventory_items)
                            tool_content = json.dumps(result, ensure_ascii=False)
                        else:
                            tool_content = str(result)
                        
                        print(f"   Tool {tool_name} returned: {tool_content[:200]}...")
                        
                        # Add tool result to messages
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "content": tool_content
                        })
                        
                        # Extract media URLs from tool results (only one per get_girl result)
                        if isinstance(result, dict) and "materials" in result:
                            materials = result.get("materials", [])
                            for material in materials:
                                if material.get("media_url"):
                                    media_urls.append(material["media_url"])
                                    break  # only send one picture per girl result
                    except Exception as e:
                        print(f"Error executing tool {tool_name}: {e}")
                        # Add error message as tool result
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "content": f"Error executing {tool_name}: {str(e)}"
                        })
                
                # Make second API call with tool results
                payload["messages"] = messages
                # IMPORTANT: Remove forced tool_choice for second call - let Grok respond naturally
                if "tool_choice" in payload:
                    del payload["tool_choice"]
                payload["tool_choice"] = "auto"  # Allow Grok to decide whether to use tools or respond
                
                # If this is a task request, inject TASK_MODULE before the second call
                if is_task_request:
                    task_module_message = {
                        "role": "system",
                        "content": TASK_MODULE
                    }
                    # Insert before the last message (tool result)
                    messages.insert(-1, task_module_message)
                    payload["messages"] = messages
                    print(f"📋 Injected TASK_MODULE for task request")
                
                print(f"📤 Making second API call with {len(messages)} messages")
                print(f"   Last message type: {messages[-1].get('role')}")
                print(f"   Tool choice in payload: {payload.get('tool_choice', 'NOT SET')}")
                
                response = await client.post(
                    GROK_API_URL,
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()
                
                print(f"📥 Second API response received")
                print(f"   Full response keys: {list(data.keys())}")
                
                if "choices" in data and len(data["choices"]) > 0:
                    assistant_message = data["choices"][0]["message"]
                    content = assistant_message.get('content', '')
                    refusal = assistant_message.get('refusal', None)
                    
                    print(f"   Response content length: {len(content)}")
                    print(f"   Response content preview: {content[:200] if content else 'EMPTY'}")
                    print(f"   Message keys: {list(assistant_message.keys())}")
                    
                    # Execute any side-effect tool calls from the second response (e.g. create_task)
                    second_tool_calls = assistant_message.get("tool_calls", [])
                    if second_tool_calls:
                        print(f"   🔧 Second call tool calls: {[tc.get('function', {}).get('name') for tc in second_tool_calls]}")
                        for tc in second_tool_calls:
                            tc_name = tc.get("function", {}).get("name")
                            tc_args_str = tc.get("function", {}).get("arguments", "{}")
                            try:
                                tc_args = json.loads(tc_args_str)
                                result = execute_tool_call(tc_name, tc_args)
                                print(f"   ✅ Executed {tc_name}: {str(result)[:100]}")
                            except Exception as e:
                                print(f"   ❌ Failed to execute {tc_name}: {e}")

                    # Log refusal if present - this is why Grok isn't generating content
                    if refusal:
                        print(f"   ⚠️ GROK REFUSAL DETECTED: {json.dumps(refusal, indent=2)}")
                        print(f"   This means Grok is refusing to generate content, likely due to content filtering")
                else:
                    print("   ⚠️ No choices in second API response")
                    print(f"   Full response: {json.dumps(data, indent=2)[:500]}")
                    raise HTTPException(
                        status_code=500,
                        detail="No response from Grok after tool execution"
                    )
            
            # Extract final response
            final_response = assistant_message.get("content", "")
            
            # If no content but we had tool calls, try to construct a response from tool results
            if not final_response and tool_calls:
                print("⚠️ Warning: No response content after tool calls")
                print(f"   Tool results: {tool_results}")
                
                # Try to construct a basic response from tool results
                if tool_results:
                    task_result = tool_results[0]
                    
                    # Handle dict result (new format)
                    if isinstance(task_result, dict):
                        if "error" in task_result:
                            error_msg = task_result['error']
                            if "no tasks available" in error_msg.lower():
                                final_response = f"Nothing available right now, sissy. Activate your inventory items or get some tasks set up first."
                            else:
                                final_response = f"Ran into a problem fetching your task: {error_msg}"
                        elif "available_tasks" in task_result:
                            tasks = task_result.get("available_tasks", [])
                            if tasks:
                                task = tasks[0]
                                task_name = task.get("task_name", "")
                                # Return just the task name — Grok should have rephrased, this is last-resort fallback
                                final_response = f"Your task: {task_name}. Get to work."
                            else:
                                final_response = "Nothing available right now. Get your inventory sorted."
                        elif "task_name" in task_result:
                            task_name = task_result.get("task_name", "")
                            final_response = f"Your task: {task_name}. Get to work."
                        else:
                            final_response = "Got the task data but something went wrong generating a response. Try again."
                    
                    # Handle old string format (backward compatibility)
                    elif isinstance(task_result, str):
                        cleaned = task_result.replace("TASK FROM DATABASE:\n", "").replace("Use this EXACT task from the database. Do not make up your own task.", "").strip()
                        final_response = cleaned
                    else:
                        final_response = "Got the info but couldn't generate a response. Try again."
                else:
                    final_response = "Something went wrong fetching that. Try again."
            
            # Save assistant response to history
            save_chat_message("assistant", final_response)

            # If this was a task request and create_task wasn't already called by the model,
            # auto-save the task directly from the response so it always appears on the task page.
            if is_task_request and final_response:
                # Check whether create_task was already executed in the second-call tool loop
                second_call_created = any(
                    tc.get("function", {}).get("name") == "create_task"
                    for tc in (assistant_message.get("tool_calls") or [])
                ) if assistant_message else False

                if not second_call_created:
                    # Derive a short task name: first sentence up to 80 chars
                    first_sentence = final_response.split(".")[0].split("\n")[0].strip()
                    task_name = first_sentence[:80] if first_sentence else "Task"
                    try:
                        result = create_task(task_name, final_response)
                        print(f"📝 Auto-saved task: {result}")
                    except Exception as e:
                        print(f"⚠️ Failed to auto-save task: {e}")
            
            return ChatResponse(
                response=final_response,
                model=GROK_MODEL,
                usage=data.get("usage", {}),
                media_urls=media_urls if media_urls else None
            )
    
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Grok API error: {e.response.text}"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Grok API: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
