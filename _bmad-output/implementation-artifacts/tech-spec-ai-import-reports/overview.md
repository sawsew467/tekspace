# Overview

## Problem Statement

Owner/Manager muốn migrate dữ liệu daily report từ **bất kỳ nền tảng chat** nào (Slack, Discord, MS Teams...) sang TekSpace để:
1. Có lịch sử làm việc thực tế cho analytics/dashboard
2. Team members thấy lại bản thân đã làm gì, không cảm thế "bắt đầu từ đầu"
3. **Dùng lại cho bất kỳ team nào — không chỉ team hiện tại** (requirement cốt lõi)

## Solution

Xây **Admin Import Page** (`/admin/import`) — cho phép owner/manager paste daily report text từ **bất kỳ nền tảng** (Slack, Discord, MS Teams...), AI-assisted parse → preview → user mapping → import vào TekSpace.

## Scope

**In Scope:**
- Admin page tại `/admin/import` (chỉ owner/manager thấy trong sidebar)
- **LLM-powered parser** — parse bất kỳ format nào
- User mapping: inline dropdown + localStorage persistence
- Preview table trước khi import (read-only)
- Upsert vào `daily_reports` + `report_tasks` (Skip / Overwrite)
- Result summary: imported, skipped, errors
- Audit log

**Out of Scope:**
- OAuth/API integration với bất kỳ nền tảng nào (chỉ text paste)
- Auto-import hàng ngày
- Export dữ liệu
- Edit parsed data trước khi import
- Platform-specific preprocessing
