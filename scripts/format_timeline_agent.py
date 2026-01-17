#!/usr/bin/env python3
"""
Format Daily Timeline Agent

This script runs on GitHub Actions to automatically format daily journal timeline
entries in Roam Research using Claude AI.

Usage:
    python format_timeline_agent.py

Environment Variables Required:
    - ANTHROPIC_API_KEY: Anthropic API key
    - ANTHROPIC_BASE_URL: Anthropic API base URL (optional)
    - ANTHROPIC_MODEL: Model to use (optional, default: claude-sonnet-4-20250514)
    - ROAM_API_TOKEN: Roam Research API token
    - ROAM_GRAPH_NAME: Roam graph name
"""

import os
import sys
import json
import re
import requests
from datetime import datetime, timedelta, timezone
from typing import Optional

# Default to UTC+8 (Beijing Time) if not specified
TZ_HOURS = int(os.environ.get("TZ_HOURS", 8))

# Import Anthropic for Claude SDK
try:
    from anthropic import Anthropic
except ImportError:
    print("anthropic package not installed. Install with: pip install anthropic")
    sys.exit(1)


# Roam API Configuration
ROAM_API_BASE = "https://api.roamresearch.com/api/graph"
PEERS = [
    "peer-24.api.roamresearch.com:3001",
    "peer-25.api.roamresearch.com:3001",
    "peer-23.api.roamresearch.com:3001",
]


class RoamClient:
    """Client for interacting with Roam Research API."""

    def __init__(self, graph_name: str, api_token: str):
        self.graph_name = graph_name
        self.api_token = api_token

    def _make_request(self, endpoint: str, data: dict, use_peers: bool = False) -> dict:
        """Make a request to Roam API with fallback to peer servers."""
        url = f"{ROAM_API_BASE}/{self.graph_name}/{endpoint}"
        urls_to_try = [url] + (
            [f"https://{p}/api/graph/{self.graph_name}/{endpoint}" for p in PEERS]
            if use_peers else []
        )

        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "x-authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json; charset=utf-8",
        }
        body = json.dumps(data)

        last_error = ""
        for current_url in urls_to_try:
            try:
                response = requests.post(
                    current_url,
                    headers=headers,
                    data=body,
                    timeout=30,
                )
                if response.status_code == 308:
                    location = response.headers.get("location")
                    if location:
                        redirect_response = requests.post(
                            location, headers=headers, data=body, timeout=30
                        )
                        if redirect_response.ok:
                            return redirect_response.json()
                    continue

                if response.ok:
                    return response.json()

                if response.status_code == 404:
                    continue

                last_error = response.text
            except Exception as e:
                last_error = str(e)
                continue

        raise Exception(f"Roam API error: {last_error}")

    def query(self, query: str) -> dict:
        """Execute a Datalog query."""
        print(f"  [QUERY] {query[:100]}...")
        return self._make_request("q", {"query": query, "args": []})

    def write(self, action: str, **data) -> dict:
        """Execute a write action."""
        return self._make_request("write", {"action": action, **data}, use_peers=True)

    def get_daily_page_uid(self, date: datetime) -> Optional[str]:
        """Get the UID of a daily notes page."""
        # Roam daily notes format: "January 17th, 2026"
        page_title = self._format_roam_date(date)
        query = f"""[:find ?uid :where [?p :node/title ?title] [?p :block/uid ?uid] [(= ?title "{page_title}")]]"""
        try:
            result = self.query(query)
            if result.get("result") and len(result["result"]) > 0:
                return result["result"][0][0]
            else:
                print(f"  [DEBUG] Page not found: '{page_title}'")
        except Exception as e:
            print(f"  [DEBUG] Error finding page '{page_title}': {e}")
        return None

    def _format_roam_date(self, date: datetime) -> str:
        """Format date as Roam daily note title: 'January 17th, 2026'."""
        day = date.day
        suffix = "th" if 4 <= day <= 20 or 24 <= day <= 30 else ["st", "nd", "rd"][day % 10 - 1]
        return f"{date.strftime('%B')} {day}{suffix}, {date.year}"

    def find_timeline_block_uid(self, page_uid: str) -> Optional[str]:
        """Find the Timeline block UID under a page."""
        query = f"""[:find ?uid ?str :where
          [?b :block/uid "{page_uid}"]
          [?b :block/children ?c]
          [?c :block/uid ?uid]
          [?c :block/string ?str]
          [(clojure.string/includes? ?str "Timeline")]]"""
        try:
            result = self.query(query)
            if result.get("result") and len(result["result"]) > 0:
                return result["result"][0][0]
        except Exception:
            pass
        return None

    def get_timeline_entries(self, timeline_uid: str) -> list[dict]:
        """Get all entries under the Timeline block."""
        query = f"""[:find (pull ?child [:block/uid :block/string :block/order]) :where
          [?b :block/uid "{timeline_uid}"]
          [?b :block/children ?child]]"""
        try:
            result = self.query(query)
            blocks = result.get("result", [])
            entries = []
            for item in blocks:
                block = item[0] if item else {}
                string = block.get(":block/string", "")
                uid = block.get(":block/uid", "")
                order = block.get(":block/order", 0)
                entries.append({
                    "uid": uid,
                    "content": string,
                    "order": order,
                })
            return sorted(entries, key=lambda x: x.get("order", 0))
        except Exception:
            return []

    def delete_block(self, block_uid: str) -> bool:
        """Delete a block."""
        try:
            print(f"  [API] Deleting block: {block_uid}")
            result = self.write("delete-block", block={"uid": block_uid})
            print(f"  [API] Delete result: {result}")
            return True
        except Exception as e:
            print(f"  [API] Delete error: {e}")
            return False

    def batch_actions(self, actions: list[dict]) -> bool:
        """Execute multiple actions in a single request to avoid rate limiting."""
        print(f"  [BATCH] Executing {len(actions)} actions in batch...")
        try:
            # Convert to Roam batch format
            roam_actions = []
            for action in actions:
                action_type = action.get("type")
                if action_type == "delete":
                    roam_actions.append({
                        "action": "delete-block",
                        "block": {"uid": action.get("uid")}
                    })
                elif action_type == "create":
                    roam_actions.append({
                        "action": "create-block",
                        "location": {"parent-uid": action.get("parent_uid"), "order": "last"},
                        "block": {"string": action.get("string")}
                    })

            result = self.write("batch-actions", actions=roam_actions)
            print(f"  [BATCH] Result: {result}")
            return True
        except Exception as e:
            print(f"  [BATCH] Error: {e}")
            return False


def get_today_date() -> datetime:
    """Get today's date in local timezone (default UTC+8 for Beijing)."""
    utc_now = datetime.now(timezone.utc)
    local_tz = timezone(timedelta(hours=TZ_HOURS))
    return utc_now.astimezone(local_tz).replace(tzinfo=None)


def get_yesterday_date() -> datetime:
    """Get yesterday's date in local timezone."""
    return get_today_date() - timedelta(days=1)


def parse_time_to_minutes(time_str: str) -> int:
    """Parse HH:MM to minutes since midnight."""
    match = re.match(r"(\d{2}):(\d{2})", time_str)
    if match:
        hours = int(match[1])
        minutes = int(match[2])
        return hours * 60 + minutes
    return 0


def format_duration(minutes: int) -> str:
    """Format duration in minutes to display format."""
    if minutes < 60:
        return f"{minutes}'"
    else:
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours}h{mins:02d}'"


def calculate_duration(start: str, end: str) -> int:
    """Calculate duration in minutes between two times."""
    start_minutes = parse_time_to_minutes(start)
    end_minutes = parse_time_to_minutes(end)
    diff = end_minutes - start_minutes
    if diff < 0:
        diff += 24 * 60  # Handle midnight crossing
    return diff


class TimelineFormatter:
    """Handles timeline formatting logic."""

    def __init__(self, roam_client: RoamClient):
        self.roam = roam_client
        self.skill_md = self._load_skill_guide()

    def _load_skill_guide(self) -> str:
        """Load the format-daily-timeline skill guide."""
        skill_path = os.path.join(
            os.path.dirname(__file__), "..", "doc", "format-daily-timeline", "SKILL.md"
        )
        # Also check current directory for skill file
        alt_path = os.path.join(os.path.dirname(__file__), "..", "SKILL.md")

        for path in [skill_path, alt_path]:
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        return f.read()
                except Exception:
                    pass
        return ""

    def _parse_json_response(self, response_text: str) -> Optional[dict]:
        """Robustly parse JSON from Claude response, handling nested structures and truncated responses."""
        print(f"[DEBUG] Input response_text ({len(response_text)} chars)")
        try:
            # Strip markdown code block markers
            cleaned = response_text.strip()
            # Remove ```json and ``` markers
            cleaned = re.sub(r'^```json\s*', '', cleaned, flags=re.MULTILINE)
            cleaned = re.sub(r'\s*```$', '', cleaned, flags=re.MULTILINE)
            # Also handle just ``` markers
            cleaned = re.sub(r'^```\s*', '', cleaned, flags=re.MULTILINE)
            cleaned = re.sub(r'\s*```$', '', cleaned, flags=re.MULTILINE)

            cleaned = cleaned.strip()
            print(f"[DEBUG] Cleaned text ({len(cleaned)} chars)")

            # Find the first { and last } to extract the JSON object
            first_brace = cleaned.find('{')
            last_brace = cleaned.rfind('}')
            print(f"[DEBUG] first_brace={first_brace}, last_brace={last_brace}")

            if first_brace == -1 or last_brace == -1 or last_brace < first_brace:
                print(f"[DEBUG] Could not find JSON boundaries in response")
                return None

            json_str = cleaned[first_brace:last_brace + 1]
            print(f"[DEBUG] Extracted JSON ({len(json_str)} chars)")

            # Try to parse JSON
            try:
                result = json.loads(json_str)
                print(f"[DEBUG] Successfully parsed JSON with keys: {list(result.keys())}")
                return result
            except json.JSONDecodeError as e:
                print(f"[DEBUG] JSON decode error: {e}")
                # Try to fix truncated JSON by trying to complete it
                print(f"[DEBUG] Attempting to handle truncated response...")
                result = self._try_parse_truncated_json(json_str)
                if result:
                    print(f"[DEBUG] Successfully parsed truncated JSON")
                    return result
                return None

        except Exception as e:
            print(f"[DEBUG] Unexpected error parsing JSON: {e}")
            return None

    def _try_parse_truncated_json(self, json_str: str) -> Optional[dict]:
        """Attempt to parse truncated JSON by finding valid prefix."""
        try:
            # Try to find valid JSON prefix
            # Check if we can at least parse part of the response
            lines = json_str.split('\n')
            valid_lines = []
            for line in lines:
                valid_lines.append(line)
                try:
                    test_str = '\n'.join(valid_lines)
                    result = json.loads(test_str)
                    # If we can parse it, continue adding more lines
                    continue
                except json.JSONDecodeError:
                    # This line broke the JSON, try without it
                    valid_lines.pop()
                    break

            if valid_lines:
                result = json.loads('\n'.join(valid_lines))
                print(f"[DEBUG] Recovered JSON with {len(result)} keys from {len(valid_lines)} lines")
                return result
        except Exception as e:
            print(f"[DEBUG] Failed to parse truncated JSON: {e}")
        return None

    def get_prompt_for_both_days(
        self,
        yesterday_entries: list[dict],
        yesterday_last_end: Optional[str],
        today_entries: list[dict],
        today_timeline_uid: str,
        yesterday_timeline_uid: Optional[str]
    ) -> str:
        """Generate the Claude prompt for formatting both yesterday and today timelines."""

        # Format yesterday entries for the prompt
        yesterday_text = "\n".join([
            f"- [{e['uid']}] {e['content']}" for e in yesterday_entries
        ]) if yesterday_entries else "(No yesterday entries)"

        # Format today entries for the prompt
        today_text = "\n".join([
            f"- [{e['uid']}] {e['content']}" for e in today_entries
        ]) if today_entries else "(No today entries)"

        prompt = f"""You are a specialized agent for formatting daily journal timeline entries in Roam Research.

## IMPORTANT: SEPARATE DAYS STRICTLY

**YESTERDAY'S ENTRIES** and **TODAY'S ENTRIES** are COMPLETELY SEPARATE timelines!
- Each timeline has its own block UID (see below)
- Entries from yesterday should ONLY appear in the yesterday timeline
- Entries from today should ONLY appear in the today timeline
- DO NOT mix entries between the two days

## Yesterday's Timeline (January 16th)
These entries are in the Timeline block with UID: {yesterday_timeline_uid or "N/A"}
{yesterday_text}

## Today's Timeline (January 17th)
These entries are in the Timeline block with UID: {today_timeline_uid}
{today_text}

## Standard Format
All entries must follow this pattern:
```
HH:MM - HH:MM (**duration**) - activity description
```

## CRITICAL RULES

1. **STRICT TIME ORDER**: Each entry's start time must be AFTER the previous entry's end time!
   - Yesterday starts at: 00:00 or the first time mentioned
   - Today starts after yesterday ends: {yesterday_last_end or "(unknown)"}

2. **NO DAY MIXING**:
   - Entries about yesterday (Jan 16th) go ONLY in yesterday's JSON array
   - Entries about today (Jan 17th) go ONLY in today's JSON array
   - If a time reference crosses days (e.g., "昨晚上两点半睡到今天早上8点半"), put the overnight part in yesterday and the morning part in today

3. **UPDATE EXISTING**: Use "update" with the original UID to modify content
4. **DELETE DUPLICATES**: If entries are out of order or duplicated, use "delete"
5. **CREATE NEW**: Only use "create" for truly new entries not in the original list

## Output Format

Return JSON with exactly two keys: "yesterday" and "today"

```json
{{
  "yesterday": [
    {{"type": "update", "uid": "original-uid", "string": "HH:MM - HH:MM (**XX'**) - description"}},
    {{"type": "delete", "uid": "original-uid-to-remove"}}
  ],
  "today": [
    {{"type": "update", "uid": "original-uid", "string": "HH:MM - HH:MM (**XX'**) - description"}},
    {{"type": "create", "string": "HH:MM - HH:MM (**XX'**) - new description"}}
  ]
}}
```

Output ONLY valid JSON starting with {{ and ending with }}}}."""

        return prompt

    def format_today(self) -> bool:
        """Format today's timeline entries."""
        today = get_today_date()
        yesterday = get_yesterday_date()

        # Get today's page UID
        today_uid = self.roam.get_daily_page_uid(today)
        if not today_uid:
            print(f"Today's page not found: {self.roam._format_roam_date(today)}")
            return False

        print(f"Found today's page: {today_uid}")

        # Find Timeline block
        timeline_uid = self.roam.find_timeline_block_uid(today_uid)
        if not timeline_uid:
            print("Timeline block not found")
            return False

        print(f"Found Timeline block: {timeline_uid}")

        # Get yesterday's last entry end time AND yesterday entries to format
        yesterday_uid = self.roam.get_daily_page_uid(yesterday)
        yesterday_last_end = None
        yesterday_entries = []  # Initialize to avoid UnboundLocalError
        yesterday_entries_to_format = []

        print(f"[DEBUG] Looking for yesterday's page: {self.roam._format_roam_date(yesterday)}")
        print(f"[DEBUG] Yesterday UID: {yesterday_uid}")

        if yesterday_uid:
            yesterday_timeline_uid = self.roam.find_timeline_block_uid(yesterday_uid)
            print(f"[DEBUG] Yesterday Timeline UID: {yesterday_timeline_uid}")
            if yesterday_timeline_uid:
                yesterday_entries = self.roam.get_timeline_entries(yesterday_timeline_uid)
                print(f"[DEBUG] Yesterday entries count: {len(yesterday_entries)}")
                if yesterday_entries:
                    print("[DEBUG] Yesterday entries:")
                    for i, entry in enumerate(yesterday_entries):
                        print(f"  [{i}] UID={entry['uid']}: {entry['content'][:80]}...")
                    # Find last entry with standard format
                    for entry in reversed(yesterday_entries):
                        match = re.search(r"(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})", entry["content"])
                        if match:
                            yesterday_last_end = match[2]
                            print(f"[DEBUG] Found last end time: {yesterday_last_end}")
                            break
                    # Collect entries that need formatting
                    # Check for both English () and Chinese （） brackets
                    # Match patterns like: (**56'**) or （**56'**）
                    yesterday_entries_to_format = [
                        e for e in yesterday_entries
                        if not re.search(r"[()（）]\*\*\d+\'\*\*[()（）]", e["content"])
                    ]
                    if yesterday_entries_to_format:
                        print(f"[DEBUG] Yesterday entries needing format: {len(yesterday_entries_to_format)}")
                else:
                    print("[DEBUG] No entries found in yesterday's Timeline")
            else:
                print("[DEBUG] No Timeline block found in yesterday's page")
        else:
            print("[DEBUG] Yesterday's page not found")

        print(f"Yesterday's last end time: {yesterday_last_end}")

        # Get today's entries
        today_entries = self.roam.get_timeline_entries(timeline_uid)
        if not today_entries:
            print("No entries to format")
            return False

        print(f"[DEBUG] Found {len(today_entries)} entries to process:")
        for i, entry in enumerate(today_entries):
            print(f"  [{i}] UID={entry['uid']}: {entry['content'][:80]}...")

        # Collect today's entries that need formatting
        # Check for both English () and Chinese （） brackets
        today_entries_to_format = [
            e for e in today_entries
            if not re.search(r"[()（）]\*\*\d+\'\*\*[()（）]", e["content"])
        ]
        if today_entries_to_format:
            print(f"[DEBUG] Today entries needing format: {len(today_entries_to_format)}")

        # Generate prompt for both days
        prompt = self.get_prompt_for_both_days(
            yesterday_entries,
            yesterday_last_end,
            today_entries,
            timeline_uid,
            yesterday_timeline_uid
        )

        # Call Claude
        anthropic_client = Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            base_url=os.environ.get("ANTHROPIC_BASE_URL") or None,
        )

        model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
        print(f"Using model: {model}")

        try:
            # Force JSON output without thinking - use higher max_tokens for long responses
            response = anthropic_client.messages.create(
                model=model,
                max_tokens=16384,
                system="You are a JSON-only response agent. Always output valid JSON in the exact format requested. Do not include any explanation, thinking, or markdown formatting outside the JSON. Start your response directly with { and end with }.",
                messages=[{"role": "user", "content": prompt}],
            )

            print(f"[DEBUG] Response type: {type(response)}")
            print(f"[DEBUG] Response id: {getattr(response, 'id', 'N/A')}")
            print(f"[DEBUG] Response content length: {len(response.content) if hasattr(response, 'content') else 0}")

            # Extract response text from content blocks
            response_text = ""
            thinking_text = ""

            if hasattr(response, 'content'):
                for i, block in enumerate(response.content):
                    block_type = type(block).__name__
                    print(f"[DEBUG] Block {i}: {block_type}")

                    if hasattr(block, 'type') and block.type == 'text':
                        # Text block
                        response_text = getattr(block, 'text', '') or ''
                        print(f"[DEBUG] Found text block: {response_text[:200] if response_text else 'EMPTY'}...")
                    elif hasattr(block, 'thinking'):
                        # Thinking block - extract thinking content
                        thinking_str = block.thinking if isinstance(block.thinking, str) else str(block.thinking)
                        thinking_text += thinking_str
                        print(f"[DEBUG] Found thinking block: {thinking_str[:200]}...")

            # If no text block, use thinking content as response
            if not response_text and thinking_text:
                print(f"[DEBUG] Using thinking content as response")
                response_text = thinking_text

            if not response_text:
                print("[ERROR] No text content in response")
                print(f"[DEBUG] Full response: {response}")
                return False

            print(f"\nClaude response:\n{response_text[:500]}...")

            # Parse JSON from response - use robust parsing for long responses
            result = self._parse_json_response(response_text)
            if not result:
                print("[ERROR] Could not parse actions from response")
                return False

            # Process both yesterday and today's actions
            all_actions = []
            for day in ["yesterday", "today"]:
                day_actions = result.get(day, [])
                print(f"[DEBUG] {day.capitalize()} actions: {len(day_actions)}")
                for action in day_actions:
                    action["day"] = day  # Tag with day for reference
                    all_actions.append(action)

            print(f"[DEBUG] Total actions to execute: {len(all_actions)}")

            # Execute batch actions for both days
            if all_actions:
                self._execute_batch_actions(all_actions, timeline_uid, yesterday_timeline_uid)

            print("Done!")
            return True

        except Exception as e:
            print(f"Error calling Claude: {e}")
            return False

    def _execute_batch_actions(
        self,
        all_actions: list[dict],
        today_timeline_uid: str,
        yesterday_timeline_uid: Optional[str]
    ):
        """Execute batch actions for both days."""
        print(f"\nExecuting {len(all_actions)} actions via batch...")

        # Group by day
        yesterday_actions = [a for a in all_actions if a.get("day") == "yesterday"]
        today_actions = [a for a in all_actions if a.get("day") == "today"]

        # Execute yesterday actions
        if yesterday_actions:
            print(f"  Processing {len(yesterday_actions)} yesterday actions...")
            self._execute_day_actions(yesterday_actions, yesterday_timeline_uid, "yesterday")

        # Execute today actions
        if today_actions:
            print(f"  Processing {len(today_actions)} today actions...")
            self._execute_day_actions(today_actions, today_timeline_uid, "today")

    def _execute_day_actions(
        self,
        actions: list[dict],
        timeline_uid: Optional[str],
        day_name: str
    ):
        """Execute actions for a single day."""
        if not timeline_uid:
            print(f"  [WARN] No timeline UID for {day_name}, skipping")
            return

        # Separate deletes and creates
        # Separate action types
        updates = [a for a in actions if a.get("type") == "update"]
        creates = [a for a in actions if a.get("type") == "create"]
        deletes = [a for a in actions if a.get("type") == "delete"]

        # Execute updates in batch (preferred method - preserves block UID)
        if updates:
            print(f"    Updating {len(updates)} {day_name} entries...")
            roam_updates = [
                {
                    "action": "update-block",
                    "block": {"uid": a["uid"], "string": a["string"]}
                }
                for a in updates
            ]
            try:
                self.roam.write("batch-actions", actions=roam_updates)
                print(f"    [OK] Updated {len(updates)} {day_name} entries")
            except Exception as e:
                print(f"    [ERROR] Update failed: {e}")

        # Execute deletes in batch (only if update is not possible)
        if deletes:
            print(f"    Deleting {len(deletes)} {day_name} entries...")
            roam_deletes = [
                {"action": "delete-block", "block": {"uid": a["uid"]}}
                for a in deletes
            ]
            try:
                self.roam.write("batch-actions", actions=roam_deletes)
                print(f"    [OK] Deleted {len(deletes)} {day_name} entries")
            except Exception as e:
                print(f"    [ERROR] Delete failed: {e}")

        # Execute creates in batch
        if creates:
            print(f"    Creating {len(creates)} {day_name} entries...")
            roam_creates = [
                {
                    "action": "create-block",
                    "location": {"parent-uid": timeline_uid, "order": "last"},
                    "block": {"string": a["string"]}
                }
                for a in creates
            ]
            try:
                self.roam.write("batch-actions", actions=roam_creates)
                print(f"    [OK] Created {len(creates)} {day_name} entries")
            except Exception as e:
                print(f"    [ERROR] Create failed: {e}")


def main():
    """Main entry point."""
    print("=" * 50)
    print("Format Daily Timeline Agent")
    print("=" * 50)
    print(f"Run time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Check required environment variables
    required_vars = ["ANTHROPIC_API_KEY", "ROAM_API_TOKEN", "ROAM_GRAPH_NAME"]
    missing = [v for v in required_vars if not os.environ.get(v)]
    if missing:
        print(f"Error: Missing required environment variables: {', '.join(missing)}")
        sys.exit(1)

    # Initialize Roam client
    graph_name = os.environ["ROAM_GRAPH_NAME"]
    api_token = os.environ["ROAM_API_TOKEN"]
    roam = RoamClient(graph_name, api_token)

    # Format timeline
    formatter = TimelineFormatter(roam)
    success = formatter.format_today()

    if success:
        print("\nTimeline formatted successfully!")
        sys.exit(0)
    else:
        print("\nFailed to format timeline")
        sys.exit(1)


if __name__ == "__main__":
    main()
