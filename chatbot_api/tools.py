"""
Tool functions for Grok to call
"""
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import Optional, Dict, List, Any

# Load environment variables
load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"✅ Supabase client initialized in tools.py")
else:
    print(f"⚠️ Supabase not configured in tools.py - URL: {bool(SUPABASE_URL)}, KEY: {bool(SUPABASE_KEY)}")


def get_task(category: Optional[str] = None) -> Dict[str, Any]:
    """
    Get available tasks from the database where all required inventory items are active.
    Uses database-side filtering via PostgreSQL function for optimal performance.
    Only call this when user explicitly requests a task.
    Returns a dict with available tasks and active inventory items.
    """
    if not supabase:
        return {"error": "Database not configured. Cannot fetch tasks."}
    
    try:
        # Call PostgreSQL function for database-side filtering (much faster)
        # This filters tasks where all required_inventory_ids are in active inventory
        tasks_response = supabase.rpc('get_available_tasks').execute()
        
        # Get active inventory names for response
        inventory_response = supabase.table("inventory").select("name").eq("is_active", True).execute()
        active_inventory_names = [item["name"] for item in (inventory_response.data or []) if item.get("name")]
        
        if not tasks_response.data or len(tasks_response.data) == 0:
            return {"error": "No tasks available in the database.", "active_inventory": active_inventory_names}
        
        # Format tasks for response
        available_tasks = []
        for task in tasks_response.data:
            available_tasks.append({
                "task_name": task.get('name', 'Unnamed'),
                "description": task.get('description', ''),
                "requirements": task.get('requirements', '')  # Keep for backward compatibility
            })
        
        if not available_tasks:
            return {
                "error": "No tasks available that can be completed with your current inventory.",
                "active_inventory": active_inventory_names,
                "all_tasks": 0
            }
        
        return {
            "available_tasks": available_tasks,
            "active_inventory": active_inventory_names,
            "total_available": len(available_tasks)
        }
        
    except Exception as e:
        print(f"Error in get_task: {e}")
        import traceback
        traceback.print_exc()
        
        # Fallback: if function doesn't exist, try basic query (for backward compatibility)
        try:
            print("⚠️ get_available_tasks function not found, falling back to basic query")
            tasks_response = supabase.table("tasks").select("*").order("created_at", desc=True).limit(10).execute()
            inventory_response = supabase.table("inventory").select("name").eq("is_active", True).execute()
            active_inventory_names = [item["name"] for item in (inventory_response.data or []) if item.get("name")]
            
            if tasks_response.data:
                available_tasks = [{
                    "task_name": task.get('name', 'Unnamed'),
                    "description": task.get('description', ''),
                    "requirements": task.get('requirements', '')
                } for task in tasks_response.data]
                
                return {
                    "available_tasks": available_tasks,
                    "active_inventory": active_inventory_names,
                    "total_available": len(available_tasks)
                }
        except Exception as fallback_error:
            print(f"Fallback also failed: {fallback_error}")
        
        return {"error": f"Error fetching task from database: {str(e)}"}


def get_girl() -> Dict[str, Any]:
    """
    Get a random girl and her materials from the database.
    Returns a dict with girl info and material URLs.
    """
    if not supabase:
        return {"error": "Database not configured. Cannot fetch girls."}
    
    try:
        # Get all girls
        girls_response = supabase.table("girls").select("*").execute()
        
        if not girls_response.data or len(girls_response.data) == 0:
            return {"error": "No girls in database."}
        
        # Pick first girl (LLM will decide which one organically based on context)
        girl = girls_response.data[0]
        
        # Get materials for this girl
        materials_response = supabase.table("girl_material").select("*").eq("girl_id", girl["id"]).execute()
        
        materials = []
        if materials_response.data:
            for material in materials_response.data:
                materials.append({
                    "name": material.get("name", ""),
                    "description": material.get("description", ""),
                    "media_url": material.get("media_url", ""),
                    "media_type": material.get("media_type", "image")
                })
        
        return {
            "name": girl.get("name", ""),
            "physical_description": girl.get("physical_description", ""),
            "relation": girl.get("relation", ""),
            "materials": materials
        }
    except Exception as e:
        return {"error": f"Error fetching girl: {str(e)}"}


def get_inventory_items() -> List[str]:
    """
    Get active inventory items. Only return items that are active.
    Returns a list of item names.
    """
    if not supabase:
        return ["Database not configured. Cannot fetch inventory."]
    
    try:
        # Get active inventory items (check if is_active column exists)
        # If is_active doesn't exist, get all items
        try:
            response = supabase.table("inventory").select("name").eq("is_active", True).execute()
        except:
            # Fallback if is_active column doesn't exist
            response = supabase.table("inventory").select("name").execute()
        
        if response.data:
            return [item["name"] for item in response.data if item.get("name")]
        else:
            return ["No active inventory items available."]
    except Exception as e:
        return [f"Error fetching inventory: {str(e)}"]


def format_time_difference(timestamp_str: Optional[str]) -> str:
    """
    Calculate time difference between a timestamp and now.
    Returns formatted string like "3 days 4 hrs" or "5 days 4 hrs ago"
    """
    if not timestamp_str:
        return "N/A"
    
    try:
        # Parse the timestamp (Supabase returns ISO format strings)
        if isinstance(timestamp_str, str):
            # Handle timezone-aware timestamps
            if timestamp_str.endswith('Z'):
                dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            elif '+' in timestamp_str or timestamp_str.count('-') > 2:
                dt = datetime.fromisoformat(timestamp_str)
            else:
                dt = datetime.fromisoformat(timestamp_str)
        else:
            return "N/A"
        
        # Ensure timezone-aware
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        
        # Get current time (timezone-aware)
        now = datetime.now(timezone.utc)
        
        # Calculate difference
        diff = now - dt
        
        # Extract days and hours
        total_seconds = int(diff.total_seconds())
        days = total_seconds // 86400
        hours = (total_seconds % 86400) // 3600
        
        # Format the result
        if days > 0:
            if hours > 0:
                return f"{days} day{'s' if days != 1 else ''} {hours} hr{'s' if hours != 1 else ''}"
            else:
                return f"{days} day{'s' if days != 1 else ''}"
        elif hours > 0:
            return f"{hours} hr{'s' if hours != 1 else ''}"
        else:
            minutes = total_seconds // 60
            if minutes > 0:
                return f"{minutes} min{'s' if minutes != 1 else ''}"
            else:
                return "just now"
    except Exception as e:
        print(f"Error formatting time difference: {e}")
        return "N/A"


def get_player_state() -> str:
    """
    Get player state from the database and format it.
    Returns a formatted string with player state information including time differences.
    """
    if not supabase:
        return "<PLAYER-STATE>\nerror: Database not configured"
    
    try:
        # Get the most recent player state record
        response = supabase.table("player-state").select("*").order("created_at", desc=True).limit(1).execute()
        
        if not response.data or len(response.data) == 0:
            return "<PLAYER-STATE>\nerror: No player state found in database"
        
        state = response.data[0]
        
        # Get current values
        in_chastity = state.get("in_chastity", False)
        chastity_device = state.get("chastity_device", "") or "N/A"
        location = state.get("location", "") or "N/A"
        chastity_start_time = state.get("chastity_start_time")
        last_orgasm = state.get("last_orgasm")
        last_shave = state.get("last_shave")
        
        # Format in-chastity
        in_chastity_str = "Yes" if in_chastity else "No"
        
        # Calculate time differences
        chastity_time_str = "N/A"
        if in_chastity and chastity_start_time:
            chastity_time_str = format_time_difference(chastity_start_time)
        elif not in_chastity:
            chastity_time_str = "Not in chastity"
        
        last_orgasm_str = format_time_difference(last_orgasm)
        if last_orgasm_str != "N/A":
            last_orgasm_str += " ago"
        
        last_shave_str = format_time_difference(last_shave)
        if last_shave_str != "N/A":
            last_shave_str += " ago"
        
        # Format the output
        result = f"""<PLAYER-STATE>
in-chastity: {in_chastity_str},
chastity-time: {chastity_time_str},
chastity-device: {chastity_device},
current-location: {location}
last-orgasm: {last_orgasm_str},
last-shave: {last_shave_str}
</PLAYER-STATE>"""
        
        return result
        
    except Exception as e:
        print(f"Error in get_player_state: {e}")
        import traceback
        traceback.print_exc()
        return f"<PLAYER-STATE>\nerror: {str(e)}"


# Tool definitions for Grok API
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_task",
            "description": "CRITICAL: Get available tasks from the database that can be completed with Jordan's current inventory. You MUST call this function whenever the user asks for a task. Returns a dict with 'available_tasks' (list of tasks Jordan can do), 'active_inventory' (items Jordan has), and 'total_available'. The 'description' field contains both a description of the task AND instructions for how you should present/give the task to Jordan. Use the description as guidance for how to phrase the task assignment in your own words.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Optional category filter for tasks"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_girl",
            "description": "Get a girl and her materials (photos/videos) from the database. Use this when you want to show a girl pic/video or talk about a girl. Returns girl info with material URLs that you can embed in your response.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_inventory_items",
            "description": "Get active inventory items. Use this to check what items Jordan has available before assigning tasks that require specific items.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_player_state",
            "description": "Get Jordan's current player state including chastity status, location, and time-based information (chastity duration, last orgasm, last shave). Returns a formatted string with all player state details.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    }
]
