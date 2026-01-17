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

    def get_prompt_for_today(self, today_entries: list[dict], yesterday_last_end: Optional[str]) -> str:
        """Generate the Claude prompt for formatting today's timeline."""

        entries_text = "\n".join([
            f"- [{e['uid']}] {e['content']}" for e in today_entries
        ]) if today_entries else "(No existing entries)"

        yesterday_info = ""
        if yesterday_last_end:
            yesterday_info = f"Yesterday's last entry ended at: {yesterday_last_end}"
        else:
            yesterday_info = "(Could not find yesterday's last entry)"

        prompt = f"""You are a specialized agent for formatting daily journal timeline entries in Roam Research.

## Background
You are formatting today's journal timeline entries. Each timestamp represents "what happened from the previous timestamp to this timestamp".

{yesterday_info}

## Current Timeline Entries
```
{entries_text}
```

## Standard Format
All timeline entries should follow this pattern:
```
HH:MM - HH:MM (**duration**) - activity description
```

Where:
- Start time and end time in 24-hour format (HH:MM)
- Duration with bold formatting: (**XX'**) or (**XhXX'**)
- Activity description after the dash (-)

## Rules

1. **First Entry Handling**: If today's first entry has a timestamp (e.g., "09:00 some activity"), you need to calculate its start time:
   - Use yesterday's last entry end time as the start
   - If the content mentions time ranges (e.g., "昨晚上两点半睡到今天早上8点半"), split into separate entries

2. **Duration Calculation**: For each entry, calculate duration as (end_time - start_time):
   - If < 60 minutes: use format (**XX'**)
   - If >= 60 minutes: use format (**XhXX'**)

3. **Summary Entries / Content Time References**: Entries that mention multiple time points should be SPLIT:
   - Example: "16:29 - 17:10 (**41'**) - 刚刚到17点为止，在上厕所。然后让AI重写了一下..."
   - This should be split into:
     - "16:29 - 17:00 (**31'**) - 在上厕所" (content ends at "17点")
     - "17:00 - 17:10 (**10'**) - 然后让AI重写了一下..."
   - **IMPORTANT**: Even if the entry is already in standard format, if the CONTENT mentions additional time points (like "17点", "下午1点", "12点过"), you MUST split it and DELETE the original

4. **Time Format Conversion**:
   - Decimal times like "1.06" → 1 hour 6 minutes → 13:06
   - Chinese times like "11点半" → 11:30, "下午1点10分" → 13:10
   - "X点过" → X:00, "X点" → X:00

5. **Cross-Day Continuity**: Start from yesterday's last end time, then process today's entries sequentially.

6. **Replace ALL Entries**: For entries that need formatting (e.g., using Chinese brackets `（）` instead of English `()` or missing duration), you MUST include their UIDs in the delete list. Only keep entries that are already in the correct format AND have no additional time references in the content.

## Output Format

Return a JSON object with this structure:
```json
{{
  "actions": [
    {{"type": "delete", "uid": "block-uid-to-delete"}},
    {{"type": "create", "string": "09:00 - 09:47 (**47'**) - activity description"}}
  ]
}}
```

Important:
- Use the original block UIDs for deletion
- For new entries, do NOT use "after_uid" - all new entries will be added to the Timeline block directly in order
- For splitting summary entries, create new entries and mark the original for deletion
- If the last entry only has a timestamp (no content after), this means the previous activity continued - convert it to a range entry
- DELETE all original entries that need to be replaced

Let's format the timeline:"""

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

        # Get yesterday's last entry end time
        yesterday_uid = self.roam.get_daily_page_uid(yesterday)
        yesterday_last_end = None

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
                    # Find last entry and extract end time
                    for entry in reversed(yesterday_entries):
                        match = re.search(r"(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})", entry["content"])
                        if match:
                            yesterday_last_end = match[2]
                            print(f"[DEBUG] Found last end time: {yesterday_last_end}")
                            break
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

        # Generate prompt for Claude
        prompt = self.get_prompt_for_today(today_entries, yesterday_last_end)

        # Call Claude
        anthropic_client = Anthropic(
            api_key=os.environ.get("ANTHROPIC_API_KEY"),
            base_url=os.environ.get("ANTHROPIC_BASE_URL") or None,
        )

        model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
        print(f"Using model: {model}")

        try:
            response = anthropic_client.messages.create(
                model=model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
            )

            # In Anthropic SDK v0.76.0+, response.content is a list of ContentBlock objects
            response_text = ""
            for block in response.content:
                if hasattr(block, 'text'):
                    response_text = block.text
                    break

            if not response_text:
                print("No text content in response")
                return False

            print(f"\nClaude response:\n{response_text}")

            # Parse JSON from response
            json_match = re.search(r"```json\s*(\{.*?\})\s*```", response_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                print(f"\n[DEBUG] Parsed JSON: {json_str}")
                actions = json.loads(json_str).get("actions", [])
            else:
                # Try to find JSON without code blocks
                json_match = re.search(r"\{[^{}]*\"actions\"[^{}]*\}", response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                    print(f"\n[DEBUG] Parsed JSON (no code block): {json_str}")
                    actions = json.loads(json_str).get("actions", [])
                else:
                    print("[ERROR] Could not parse actions from response")
                    print(f"[DEBUG] Full response: {response_text}")
                    return False

            print(f"[DEBUG] Total actions to execute: {len(actions)}")
            for i, action in enumerate(actions):
                print(f"  [{i}] {action}")

            # Use batch actions to avoid rate limiting
            print(f"\nExecuting {len(actions)} actions via batch...")
            deletes = [a for a in actions if a.get("type") == "delete"]
            creates = [a for a in actions if a.get("type") == "create"]

            # Convert deletes to batch format
            delete_actions = [{"type": "delete", "uid": a["uid"]} for a in deletes]

            # Convert creates to batch format
            create_actions = [
                {"type": "create", "parent_uid": timeline_uid, "string": a["string"]}
                for a in creates
            ]

            # Execute deletes in batch
            if delete_actions:
                print(f"  Deleting {len(delete_actions)} entries...")
                self.roam.batch_actions(delete_actions)

            # Execute creates in batch
            if create_actions:
                print(f"  Creating {len(create_actions)} entries...")
                self.roam.batch_actions(create_actions)

            print("Done!")
            return True

        except Exception as e:
            print(f"Error calling Claude: {e}")
            return False


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
