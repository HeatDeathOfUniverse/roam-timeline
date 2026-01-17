---
name: format-daily-timeline
description: "Standardizes and restructures daily journal timeline entries. When user wants to format timeline section with: (1) Converting entries to standard time range format (start time - end time + duration), (2) Splitting entries that contain multiple time references into separate timeline items, (3) Calculating time differences and durations automatically, (4) Maintaining consistency with existing timeline formatting patterns, (5) Auto-filling weekly link in frontmatter. Use for organizing and cleaning up daily journal timeline sections."
license: Custom. See LICENSE.md for terms
---

# Format Daily Timeline

## Overview

This skill standardizes daily journal timeline entries by converting them to a consistent format and splitting complex entries that reference multiple time points into separate, organized items. It also auto-fills the weekly link in frontmatter if missing.

## Standard Timeline Format

All timeline entries should follow this pattern:
```
- HH:MM - HH:MM （**duration**） activity description
```

**Format Components:**
- Start time (24-hour format): `HH:MM`
- End time: `HH:MM`
- Duration in minutes (with **bold** formatting): `（**XX'**）` or `（**XhXX'**）`
- Activity description

## Time Stamp Meaning

**Important Understanding:**
Each timestamp represents "what happened from the previous timestamp to this timestamp":
- `09:00 到公司` means "From the previous time to 09:00, arrived at company"
- `09:47 测试一下claude skills` means "From 09:00 to 09:47, tested claude skills"

**Special Cases:**
- **First Entry with Cross-Day Context**: When processing the first entry, ALWAYS check yesterday's journal for the last entry to establish continuity. See "Cross-Day Timeline Continuity" section below.
- **Summary Entries**: Entries that summarize what happened (e.g., "15:47 上午测试完...到现在") should be split into individual activities and then DELETED after processing

## When to Split Entries

Split timeline entries when they contain:
- Multiple time references (e.g., "背单词到1.06然后 玩了一会1.20睡到1.45")
- Sequential activities with time stamps
- Complex narratives that span multiple time periods

## Execution Workflow

### Step 1: Identify Existing Timeline Pattern
Look for the first formatted entry to understand the target format:
- Example: `- 09:51 - 10:19 （**28'**）绘制进度追踪**图表**`

### Step 2: Process Each Entry

#### For Entries Without Times
- Leave formatting unchanged
- Maintain existing indentation and bullet structure

#### For the First Entry (Cross-Day Continuity)

**CRITICAL: Always check yesterday's journal first!**

1. **Locate yesterday's journal file**: The file path follows the pattern `Daily/YYYY-MM-DD.md`. Calculate yesterday's date from the current file's date.

2. **Read yesterday's last entry**: Find the last timeline entry in yesterday's journal.

3. **Format yesterday's last entry if needed**: If yesterday's last entry is NOT in standard format (e.g., `- 01:32 洗澡...` instead of `- 00:24 - 01:32 （**1h08'**） 洗澡...`), you MUST format it first before processing today's journal. This ensures correct time continuity.

4. **Understand the timestamp meaning**: Remember that a timestamp like `01:32` means "the activity ended at 01:32", NOT "started at 01:32". So the END time of yesterday's last entry is the START time for today's first entry.

5. **Bridge the gap**: Create entries to fill the time between yesterday's last entry's END time and today's first timestamp:
   - Today's entries start from yesterday's END time (not the timestamp itself)
   - Then process today's first entry normally

6. **If the first entry contains time ranges** (e.g., "昨晚上两点半睡到今天早上8点半"): Extract and split into separate timeline items, using yesterday's last entry's END time as the starting point

#### For Entries With Single Time Point (Non-final entries)
- Convert to: `start_time - next_timestamp （**calculated_duration**） activity`
- Use the next entry's timestamp as the end time
- Calculate duration: (end_time - start_time)

#### For the Final Entry
- **If the final entry has only a timestamp (no content after):**
  - This means "the previous activity continued to this time"
  - Convert to: `previous_timestamp - final_timestamp （**duration**） previous_activity`
- **If the final entry has both timestamp and content:**
  - Do NOT modify it (leave as-is)
  - The entry represents an ongoing activity that hasn't ended

#### For Entries With Multiple Time References (Summary Entries)
1. **Identify summary entries**: These are entries that summarize what happened over a period (e.g., "15:47 上午测试完...到现在")

2. **Extract time points** from the narrative:
   - Parse times like "1.06", "1.20", "1.45", "11点半", "下午1点10分"
   - Convert all to 24-hour format (13:06, 13:20, 13:45, 11:30, 13:10)

3. **Create sequential entries**:
   - Each time point becomes a start time
   - Next time point becomes the end time
   - Calculate duration for each segment

4. **Rewrite activity descriptions**:
   - Make each description specific to that time segment
   - Remove time references from descriptions (they're now in the header)

5. **DELETE the original summary entry** after processing - the information has been converted to individual timeline items

### Step 3: Duration Calculations

**Minutes Only:**
- Format: `（**XX'**）`
- Example: 28 minutes → `（**28'**）`

**Hours and Minutes:**
- Format: `（**XhXX'**）`
- Example: 1 hour 3 minutes → `（**1h03'**）`

**Calculation Rules:**
- If duration < 60 minutes: use minutes only
- If duration >= 60 minutes: use hours and minutes
- For exact hours: use `（**Xh00'**）`

## Examples

### Example 1: Simple Time Conversion
**Before:**
```
- 10:44  [[任务监控软件-GUD]]排查左手杆连续量发送逻辑
```

**After:**
```
- 10:44 - 11:30 （**46'**） [[任务监控软件-GUD]]排查左手杆连续量发送逻辑
```

### Example 2: Multiple Time Points
**Before:**
```
- 15:13 中午吃完饭背单词到1.06然后 玩了一会1.20睡到1.45 然后骑车去公司结果自行车又爆胎了
```

**After:**
```
- 11:30 - 13:06 （**1h36'**） 午饭后背单词
- 13:06 - 13:20 （**14'**） 玩了一会
- 13:20 - 13:45 （**25'**） 午睡
- 13:45 - 14:03 （**18'**） 骑车去公司，自行车爆胎，找共享单车
```

### Example 3: Time Conversion (Decimal to 24-Hour)
**Input:** "背单词到1.06"
**Conversion:** 1.06 → 1 hour 6 minutes → 24-hour format → 13:06

**Input:** "1.20"
**Conversion:** 1.20 → 1 hour 20 minutes → 24-hour format → 13:20

### Example 4: First Entry and Summary Entry Processing
**Before:**
```
## Timeline

- 09:00 到公司 昨晚上两点半睡到今天早上 8 点半，然后洗漱一下，9 点钟到公司
- 09:47 测试claude skills能否正常运行
- 15:47 上午测试完skills就坐了会ppt 然后，11 点半去吃饭，嗯，12:10 到家。然后开始边散步边听小说，到下午 1 点 10 分。然后睡觉到下午 1:45。然后，两点钟骑车去公司 ，做 PPT 到现在
```

**Processing Steps:**
1. **First Entry**: Extract time ranges from content and split:
   - `昨晚上两点半睡到今天早上 8 点半` → `- 02:30 - 08:30 （**6h00'**） 睡觉`
   - `然后洗漱一下，9 点钟到公司` → `- 08:30 - 09:00 （**30'**） 洗漱`

2. **Second Entry**: Convert to range using next timestamp:
   - `09:47 测试claude skills` → `- 09:00 - 09:47 （**47'**） 测试claude skills`

3. **Summary Entry**: Split and delete:
   - Extract: 11:30, 12:10, 13:10, 13:45, 14:00
   - Create separate entries for each time segment
   - **DELETE** the original 15:47 summary entry after processing

**After:**
```
## Timeline

- 02:30 - 08:30 （**6h00'**） 睡觉
- 08:30 - 09:00 （**30'**） 洗漱
- 09:00 - 09:47 （**47'**） 测试claude skills能否正常运行
- 11:30 - 12:10 （**40'**） 去吃饭
- 12:10 - 13:10 （**1h00'**） 边散步边听小说
- 13:10 - 13:45 （**35'**） 午睡
- 14:00 - 15:47 （**1h47'**） 骑车去公司，做 PPT
```

### Example 5: Cross-Day Timeline Continuity

**Yesterday's Journal (2026-01-12.md) - Last Two Entries (BEFORE processing):**
```
- 21:43 - 00:24 （**2h41'**） 完成0-9的最后一题重做，听完0-10和0-11视频
- 01:32 洗澡，然后吹头发，上厕所吧。
```

**Today's Journal (2026-01-13.md) - First Entry Before Processing:**
```
## Timeline
09:01 昨天学完之后就去洗澡了，然后上了半个多小时厕所，上床已经1点半了。 然后在床上看《玄鉴仙族》。最后快2点的时候，有点困了就睡了。早上8:20起的。然后洗漱，8:40出门，找自行车到公司，8:55。
```

**Processing Steps:**
1. **Read yesterday's last entry**: `01:32 洗澡...` - this is NOT formatted!
2. **Format yesterday's last entry FIRST**:
   - The timestamp `01:32` means "activity ended at 01:32"
   - Previous entry ended at `00:24`
   - So: `- 00:24 - 01:32 （**1h08'**） 洗澡，然后吹头发，上厕所`
3. **Now yesterday's END time is `01:32`** - this is where today starts
4. **Parse today's first entry content**:
   - From `01:32` to `02:00`: 上床看《玄鉴仙族》
   - "快2点的时候睡了" → 02:00 睡觉
   - "早上8:20起的" → 08:20 起床
   - "8:40出门" → 08:40
   - "8:55到公司" → 08:55
   - "09:01" is the entry timestamp

**After Processing Yesterday's Journal (last entry only):**
```
- 21:43 - 00:24 （**2h41'**） 完成0-9的最后一题重做，听完0-10和0-11视频
- 00:24 - 01:32 （**1h08'**） 洗澡，然后吹头发，上厕所
```

**After Processing Today's Journal:**
```
## Timeline
- 01:32 - 02:00 （**28'**） 上床看《玄鉴仙族》
- 02:00 - 08:20 （**6h20'**） 睡觉
- 08:20 - 08:40 （**20'**） 洗漱
- 08:40 - 08:55 （**15'**） 出门，找自行车到公司
- 08:55 - 09:01 （**6'**） 到公司
```

**Key Points:**
- Yesterday's unformatted last entry MUST be formatted first
- Timestamp `01:32` means "ended at 01:32", not "started at 01:32"
- Today's entries start from yesterday's END time (`01:32`)
- All time references in the narrative are extracted and converted to timeline entries

## Auto-Fill Weekly Link

### Overview
When processing a daily journal, check the frontmatter `weekly` field. If it's empty or missing, calculate and fill in the correct week number link.

### Weekly Link Format
```
weekly: "[[YYYY-WXX]]"
```

Where:
- `YYYY` is the year
- `XX` is the ISO week number (01-53), zero-padded

### Calculation Rules
1. **Extract the date** from the journal filename (e.g., `2026-01-13.md` → January 13, 2026)
2. **Calculate ISO week number**: Use ISO 8601 week numbering rules:
   - Week 1 is the week containing the first Thursday of the year
   - Weeks start on Monday
3. **Handle year boundaries**: A date in early January might belong to week 52/53 of the previous year, and a date in late December might belong to week 1 of the next year
4. **Format the link**: `[[YYYY-WXX]]` with the correct year for that week

### Examples

| Date | Week Number | Weekly Link |
|------|-------------|-------------|
| 2026-01-01 | Week 1 | `[[2026-W01]]` |
| 2026-01-13 | Week 3 | `[[2026-W03]]` |
| 2025-12-29 | Week 1 of 2026 | `[[2026-W01]]` |
| 2026-12-31 | Week 53 | `[[2026-W53]]` |

### Processing Steps
1. Read the frontmatter of the journal file
2. Check if `weekly` field exists and has a value
3. If empty or missing:
   - Parse the date from filename
   - Calculate ISO week number
   - Update frontmatter with `weekly: "[[YYYY-WXX]]"`
4. If already filled, leave unchanged

## Usage Instructions

1. **Check and fill weekly link** in frontmatter if missing
2. **FIRST: Read yesterday's journal** to find the last timeline entry (for cross-day continuity)
2. **Format yesterday's last entry if unformatted**: If it's just a timestamp + content (e.g., `- 01:32 洗澡...`), format it using the previous entry's end time
3. **Read the entire timeline section** of today's journal to identify formatting patterns
4. **Handle the first entry with cross-day context**:
   - Use yesterday's last entry's END time (not the timestamp) as the starting point
   - Extract time references from today's first entry content
   - Create bridging entries to fill the gap between yesterday and today
5. **Process entries sequentially**, using each entry's start time as the previous entry's inferred end time
6. **For entries with multiple times (summary entries)**: split into separate items following the chronological order
7. **DELETE summary entries after processing** - the information has been converted to individual timeline items
8. **Calculate all durations** and format correctly (minutes vs hours+minutes)
9. **Maintain markdown formatting**: preserve bold (**), links ([[]]), indentation for sub-items

## Common Patterns

### Decimal Time Conversion
- `1.06` = 1 hour 6 minutes = `13:06`
- `2.30` = 2 hours 30 minutes = `14:30`
- `0.45` = 0 hours 45 minutes = `00:45`

### Activity Segmentation
When splitting entries:
- Keep each activity description concise
- Remove time references from descriptions (already captured in timeline)
- Group related activities logically (e.g., all commuting activities together)

## Limitations

- Cannot infer end times without context (requires next entry's start time or user input)
- Decimal time conversion assumes times are in the same day
- May need user validation for ambiguous time references
- Cross-day processing requires yesterday's journal file to exist
- If yesterday's journal is missing, fall back to processing today's first entry without cross-day context

## Quality Checks

After formatting, verify:
- [ ] Weekly link is filled in frontmatter (e.g., `weekly: "[[2026-W03]]"`)
- [ ] Yesterday's journal was checked for cross-day continuity
- [ ] All entries follow standard format: `HH:MM - HH:MM （**duration**） activity`
- [ ] Durations are correctly calculated
- [ ] Time progression is logical and sequential (including cross-day transition)
- [ ] Original meaning and context are preserved
- [ ] No time references remain in activity descriptions
- [ ] Summary entries (entries that summarize multiple time periods) have been DELETED after processing
- [ ] Sub-items and formatting are preserved
- [ ] Yesterday's entries remain unchanged (only today's journal is modified)
