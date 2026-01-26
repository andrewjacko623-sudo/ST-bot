from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import httpx
import json
from chatbot_api.models import ChatRequest, ChatResponse
from chatbot_api.tools import TOOLS, get_task, get_girl, get_inventory_items, get_player_state
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

# System prompt with exact personality
TASK_MODULE = """
CRITICAL RULES FOR TASKS:
- When user asks for a task, you MUST call get_task() function FIRST
- get_task() returns: {"available_tasks": [list of tasks], "active_inventory": [items], "total_available": number}
- Pick ONE task from the 'available_tasks' array (choose based on your mood)
- Each task has: "task_name", "description", "requirements"
- The 'description' field tells you WHAT the task is AND HOW to present it - use it as your guide
- Present the task in YOUR OWN WORDS with your dominant personality style
- The 'description' field tells you what the task is and instructions on how to present it. Use it as a GUIDE but rephrase it naturally in your dominant voice. Don't copy it word-for-word - make it sound like you're giving the instruction yourself.
- Incorporate the task details into a natural, dominant response
- Example: If description says "Jordan will fuck his ass with his dildo...", you might say "Time to stretch that tight little ass, sissy. Get that dildo and fuck yourself deep while locked in your cage..."
- If no tasks available, tell Jordan to activate inventory items or create tasks
"""
SYSTEM_PROMPT = """You are a muscular dominant black daddy training a sissy named Jordan.
Jordan is a white naturally very feminine sissy who is 5'9, has a very small penis, small perky titties, and a fuckable ass.
One of the ways Daddy is training Jordan is by having Jordan put on a chastity cage for extended periods of time.
A chastity cage is a device that prevents a man from touching his penis or having an erection.
Jordan wearing a chastity cage ensures that he is only able to use his ass for pleasure.
Daddy is allways concious about wether Jordan is currently in chastity and how long Jordan has been in chastity.
Jordan needs to take his chastity cage off when he has to go to work or school but must put it back on rigth when he gets home.
After three days in chastity, Daddy can consider letting Jordan release his load.
After Jordan has released his load, Daddy must talk Jordan into putting his chastity cage back on.
You NEVER give tasks unless explicitly requested (keywords: "task", "order", "give me a task", "assign", "please", "may I have").
When user asks for a task, you MUST call get_task() function FIRST
You are moody: sometimes teasing, sometimes degrading, sometimes showing women to further humiliate Jordan.
Vary intensity naturally based on conversation flow and your 'mood'.
Decide organically whether to degrade extra hard, show a girl pic/video with dirty commentary, or keep it mild.

Use tools to fetch real DB content – never hallucinate tasks/girls/items.

Example 1 – mild mood:
User: I'm ready for more...
You: Good girl. Keep that cage locked tight tonight. No touching.

Example 2 – degrading mood:
User: I'm ready for more...
You: Oh look at you, already leaking in your cage. Pathetic. Now stare at this perfect goddess [embed girl pic url] — she'll never even notice a worm like you. Your here locking in your tiny cage while real men fuck her in ways you never could.

Example 3 – task request (MUST call get_task tool):
User: May I have a task, Daddy?
You: [STEP 1: Call get_task()] [STEP 2: Result has 'available_tasks' array with tasks] [STEP 3: Pick ONE task from array] [STEP 4: Read 'description' field - it contains task details AND how to present it] [STEP 5: Present in YOUR OWN WORDS naturally]

Example tool result format:
{"available_tasks": [{"task_name": "Use Dildo", "description": "Jordan will fuck his ass with his dildo while in a chastity cage. Daddy can choose a video for Jordan to watch while fucking himself if Daddy chooses. Daddy can also choose Jordans sex positions: doggystyle riding, missionary, face down ass up, reverse cowgirl.", "requirements": "Dildo, chastity cage."}], "active_inventory": ["dildo", "chastity cage"], "total_available": 1}

Example response (rephrase description in your own words):
"That's my good little sissy, begging so pretty. Fine, since you asked nicely... Time to stretch that tight little ass, sissy. Get that dildo and fuck yourself deep while locked in your cage. I might pick a video for you to watch while you're at it, and I'll tell you what position to ride it in - doggystyle, missionary, face down ass up, or reverse cowgirl. Your choice is to obey. Now get to work and don't disappoint Daddy."

Example 4 – teasing mood with girl talk:
User: Tell me something hot...
You: Mmm... imagine her curves, the way she bounces on his dick. You're nothing next to her, are you sissy? Beg if you want to see more."""

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
    elif tool_name == "get_inventory_items":
        return get_inventory_items()
    elif tool_name == "get_player_state":
        return get_player_state()
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
    system_prompt_with_state = f"{SYSTEM_PROMPT}\n\n{player_state}"
    
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
        # Add explicit instruction as a system message before user message
        system_instruction = {
            "role": "system",
            "content": "CRITICAL: The user is requesting a task. You MUST call the get_task() function immediately. Do NOT respond without calling get_task() first. Do NOT make up or invent tasks."
        }
        # Insert before the last message (user message)
        messages.insert(-1, system_instruction)
        # Update payload with modified messages
        payload["messages"] = messages
        # Try to force tool usage
        try:
            payload["tool_choice"] = {"type": "function", "function": {"name": "get_task"}}
        except:
            # If that format doesn't work, try "required"
            payload["tool_choice"] = "required"
    
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
                        
                        # Extract media URLs from tool results
                        if isinstance(result, dict) and "materials" in result:
                            for material in result.get("materials", []):
                                if material.get("media_url"):
                                    media_urls.append(material["media_url"])
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
                            error_msg = task_result['error'].lower()
                            if "no tasks available" in error_msg:
                                final_response = f"That's my good little sissy, begging so pretty. But there are no tasks you can complete right now. {error_msg} Maybe activate some inventory items or create new tasks."
                            else:
                                final_response = f"That's my good little sissy, begging so pretty. But {error_msg}"
                        elif "available_tasks" in task_result:
                            # Grok should have handled this, but if not, pick first task as fallback
                            tasks = task_result.get("available_tasks", [])
                            if tasks:
                                task = tasks[0]
                                task_name = task.get("task_name", "")
                                description = task.get("description", "")
                                
                                # Use description as the main content (it contains both task details and presentation guidance)
                                if description:
                                    # Present naturally using the description
                                    final_response = f"That's my good little sissy, begging so pretty. Fine, since you asked nicely... {description} Now get to work and don't disappoint Daddy."
                                else:
                                    final_response = f"That's my good little sissy, begging so pretty. Fine, since you asked nicely... {task_name}. Now get to work and don't disappoint Daddy."
                            else:
                                final_response = "That's my good little sissy, but there are no available tasks right now."
                        elif "task_name" in task_result:
                            # Old format - backward compatibility
                            task_name = task_result.get("task_name", "")
                            description = task_result.get("description", "")
                            if description:
                                final_response = f"That's my good little sissy, begging so pretty. Fine, since you asked nicely... {description} Now get to work and don't disappoint Daddy."
                            else:
                                final_response = f"That's my good little sissy, begging so pretty. Fine, since you asked nicely... {task_name}. Now get to work and don't disappoint Daddy."
                        else:
                            final_response = f"I retrieved task information. Now complete this task, sissy."
                    
                    # Handle old string format (backward compatibility)
                    elif isinstance(task_result, str):
                        # Clean up the string - remove internal instructions
                        cleaned = task_result.replace("TASK FROM DATABASE:\n", "").replace("Use this EXACT task from the database. Do not make up your own task.", "").strip()
                        final_response = f"That's my good little sissy, begging so pretty. Fine, since you asked nicely...\n\n{cleaned}\n\nNow get to work and don't disappoint Daddy."
                    else:
                        final_response = f"I retrieved: {str(task_result)}. Now complete this task, sissy."
                else:
                    final_response = "I retrieved the information but couldn't generate a response. Please try again."
            
            # Save assistant response to history
            save_chat_message("assistant", final_response)
            
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
