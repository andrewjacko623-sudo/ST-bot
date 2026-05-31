"""
Tool functions for Grok to call
"""
import os
import random
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import Optional, Dict, List, Any

# Load environment variables
load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print(f"✅ Supabase client initialized in tools.py")
    except Exception as e:
        print(f"❌ Failed to initialize Supabase client: {e}")
        print(f"   URL present: {bool(SUPABASE_URL)}, Key present: {bool(SUPABASE_KEY)}")
        print(f"   URL length: {len(SUPABASE_URL) if SUPABASE_URL else 0}, Key length: {len(SUPABASE_KEY) if SUPABASE_KEY else 0}")
else:
    print(f"⚠️ Supabase not configured in tools.py - URL: {bool(SUPABASE_URL)}, KEY: {bool(SUPABASE_KEY)}")


def get_tasks_context() -> str:
    """
    Get pending tasks and today's completed tasks (day resets at 9am PST).
    Returns a formatted string for injection into the system prompt.
    """
    if not supabase:
        return "<TASKS>\nerror: Database not configured\n</TASKS>"

    try:
        from zoneinfo import ZoneInfo
        pst = ZoneInfo("America/Los_Angeles")
        now_pst = datetime.now(pst)

        # "Today" starts at 9am PST; if before 9am, today started at 9am yesterday
        today_start = now_pst.replace(hour=9, minute=0, second=0, microsecond=0)
        if now_pst.hour < 9:
            today_start = today_start - timedelta(days=1)
        today_start_utc = today_start.astimezone(timezone.utc).isoformat()

        # Fetch pending tasks
        pending_resp = supabase.table("tasks").select("name, description, assigned_at") \
            .eq("status", "pending").order("assigned_at", desc=False).execute()

        # Fetch today's completed tasks
        completed_resp = supabase.table("tasks").select("name, completed_at") \
            .eq("status", "completed").gte("completed_at", today_start_utc).order("completed_at", desc=False).execute()

        lines = []

        pending = pending_resp.data or []
        if pending:
            lines.append("PENDING:")
            for t in pending:
                lines.append(f"  - {t['name']}")
        else:
            lines.append("PENDING: none")

        completed_today = completed_resp.data or []
        if completed_today:
            lines.append("COMPLETED TODAY:")
            for t in completed_today:
                lines.append(f"  - {t['name']}")
        else:
            lines.append("COMPLETED TODAY: none")

        return "<TASKS>\n" + "\n".join(lines) + "\n</TASKS>"

    except Exception as e:
        return f"<TASKS>\nerror: {str(e)}\n</TASKS>"


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
        
        # Get materials for this girl, then pick ONE random material to show (one pic/video per response)
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
            # Return only one random material so the bot sends one picture, not all
            materials = [random.choice(materials)] if materials else []
        
        return {
            "name": girl.get("name", ""),
            "physical_description": girl.get("physical_description", ""),
            "relation": girl.get("relation", ""),
            "materials": materials
        }
    except Exception as e:
        return {"error": f"Error fetching girl: {str(e)}"}


def get_full_inventory() -> str:
    """
    Get the complete inventory (active and inactive) grouped by category.
    Returns a formatted string for injection into the system prompt.
    """
    if not supabase:
        return "<INVENTORY>\nerror: Database not configured\n</INVENTORY>"

    try:
        response = supabase.table("inventory").select("name, description, category, is_active").order("category").order("name").execute()
        items = response.data or []

        if not items:
            return "<INVENTORY>\nnone\n</INVENTORY>"

        groups = {}
        for item in items:
            cat = item.get("category") or "toy"
            groups.setdefault(cat, []).append(item)

        lines = []
        for cat in ["cage", "toy", "outfit"]:
            if cat not in groups:
                continue
            lines.append(f"{cat.upper()}S:")
            for item in groups[cat]:
                status = "equipped" if item.get("is_active") else "inactive"
                line = f"  - {item['name']} [{status}]"
                if item.get("description"):
                    line += f" — {item['description']}"
                lines.append(line)

        # Any other categories
        for cat, cat_items in groups.items():
            if cat in ("cage", "toy", "outfit"):
                continue
            lines.append(f"{cat.upper()}S:")
            for item in cat_items:
                status = "active" if item.get("is_active") else "inactive"
                lines.append(f"  - {item['name']} [{status}]")

        return "<INVENTORY>\n" + "\n".join(lines) + "\n</INVENTORY>"

    except Exception as e:
        return f"<INVENTORY>\nerror: {str(e)}\n</INVENTORY>"


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


def complete_task(task_id: str = None, task_name: str = None) -> Dict[str, Any]:
    """
    Mark a pending task as completed. Can look up by id or by name (partial match).
    """
    if not supabase:
        return {"error": "Database not configured."}

    try:
        now = datetime.now(timezone.utc).isoformat()

        if task_id:
            result = supabase.table("tasks").update({
                "status": "completed",
                "completed_at": now,
            }).eq("id", task_id).eq("status", "pending").execute()
        elif task_name:
            # Fetch pending tasks and match by name (case-insensitive partial)
            fetch = supabase.table("tasks").select("id, name").eq("status", "pending").execute()
            matches = [t for t in (fetch.data or []) if task_name.lower() in t.get("name", "").lower()]
            if not matches:
                return {"error": f"No pending task found matching '{task_name}'"}
            result = supabase.table("tasks").update({
                "status": "completed",
                "completed_at": now,
            }).eq("id", matches[0]["id"]).execute()
        else:
            # No id or name given — complete the most recently assigned pending task
            fetch = supabase.table("tasks").select("id, name").eq("status", "pending").order("assigned_at", desc=True).limit(1).execute()
            if not fetch.data:
                return {"error": "No pending tasks to complete."}
            result = supabase.table("tasks").update({
                "status": "completed",
                "completed_at": now,
            }).eq("id", fetch.data[0]["id"]).execute()

        completed_name = result.data[0].get("name") if result.data else task_name or task_id
        return {"completed": True, "task_name": completed_name}

    except Exception as e:
        print(f"Error in complete_task: {e}")
        return {"error": f"Error completing task: {str(e)}"}


def create_task(name: str, description: str) -> Dict[str, Any]:
    """
    Save a new task that Daddy just assigned to Jordan into the database.
    Call this after deciding on and delivering a task in chat so it appears on Jordan's task page.
    """
    if not supabase:
        return {"error": "Database not configured. Cannot save task."}

    try:
        result = supabase.table("tasks").insert({
            "name": name.strip(),
            "description": description.strip(),
            "status": "pending",
            "required_inventory_ids": None,
            "requirements": None,
        }).execute()

        if not result.data:
            return {"error": "Failed to save task — no data returned."}

        return {
            "saved": True,
            "task_name": result.data[0].get("name") if result.data else None,
            "task_id": result.data[0].get("id") if result.data else None,
            "status": result.data[0].get("status", "pending") if result.data else "pending",
        }

    except Exception as e:
        print(f"Error in create_task: {e}")
        import traceback
        traceback.print_exc()
        return {"error": f"Error saving task: {str(e)}"}


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


def format_time_until(timestamp_str: Optional[str]) -> str:
    """
    Calculate time from now until a future timestamp (end - now).
    Returns formatted string like "3 days 4 hrs remaining" or "ended" if in the past.
    """
    if not timestamp_str:
        return "N/A"

    try:
        if isinstance(timestamp_str, str):
            if timestamp_str.endswith('Z'):
                dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            else:
                dt = datetime.fromisoformat(timestamp_str)
        else:
            return "N/A"

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        diff = dt - now

        total_seconds = int(diff.total_seconds())
        if total_seconds <= 0:
            return "ended"

        days = total_seconds // 86400
        hours = (total_seconds % 86400) // 3600

        if days > 0:
            if hours > 0:
                return f"{days} day{'s' if days != 1 else ''} {hours} hr{'s' if hours != 1 else ''} remaining"
            return f"{days} day{'s' if days != 1 else ''} remaining"
        elif hours > 0:
            return f"{hours} hr{'s' if hours != 1 else ''} remaining"
        else:
            minutes = total_seconds // 60
            if minutes > 0:
                return f"{minutes} min{'s' if minutes != 1 else ''} remaining"
            return "less than 1 min remaining"
    except Exception as e:
        print(f"Error formatting time until: {e}")
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
        lockbox_endtime = state.get("chastity_lockbox_endtime")
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

        # Lockbox: end time is in Supabase, duration = end - now (time remaining)
        chastity_lockbox_duration = format_time_until(lockbox_endtime)

        # Format the output
        result = f"""<PLAYER-STATE>
in-chastity: {in_chastity_str},
chastity-time: {chastity_time_str},
chastity-lockbox-duration: {chastity_lockbox_duration},
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


def get_kinks() -> str:
    """
    Get Jordan's active kinks/fetishes from the database, split into major and minor.
    Returns a formatted string for injection into the system prompt.
    """
    if not supabase:
        return "<KINKS>\nerror: Database not configured\n</KINKS>"

    try:
        response = supabase.table("kinks").select("name, description, type").eq("is_active", True).order("created_at").execute()
        kinks = response.data or []

        if not kinks:
            return "<KINKS>\nnone configured\n</KINKS>"

        major = [k for k in kinks if (k.get("type") or "major") == "major"]
        minor = [k for k in kinks if (k.get("type") or "major") == "minor"]

        lines = []

        if major:
            lines.append("MAJOR (pick one as the task activity — rotate, avoid repeating today):")
            for k in major:
                line = f"  - {k['name']}"
                if k.get("description"):
                    line += f": {k['description']}"
                lines.append(line)

        if minor:
            lines.append("MINOR (layer onto the task for tone/flavor — never use as the whole task):")
            for k in minor:
                line = f"  - {k['name']}"
                if k.get("description"):
                    line += f": {k['description']}"
                lines.append(line)

        return "<KINKS>\n" + "\n".join(lines) + "\n</KINKS>"

    except Exception as e:
        return f"<KINKS>\nerror: {str(e)}\n</KINKS>"


# Tool definitions for Grok API
TOOLS = [
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
            "name": "create_task",
            "description": "Save a task you just assigned to Jordan into the database so it appears on his task page. Call this after delivering the task in chat. Use Jordan's active inventory, current chastity state, location, and time of day to craft a contextually appropriate task.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Short task name (e.g. 'Edge with dildo', 'Wear plug all evening')"
                    },
                    "description": {
                        "type": "string",
                        "description": "Full task description as Daddy would write it — what Jordan must do, any specific conditions, duration, positions, etc."
                    }
                },
                "required": ["name", "description"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "complete_task",
            "description": "Mark a pending task as completed in the database. Call this when Jordan reports that he has finished or done a task. Pass the task name so it can be matched. If no name is clear, omit it and the most recently assigned pending task will be completed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_name": {
                        "type": "string",
                        "description": "Name or partial name of the task Jordan completed (e.g. 'Edge with dildo'). Omit if unclear."
                    }
                },
                "required": []
            }
        }
    }
]
