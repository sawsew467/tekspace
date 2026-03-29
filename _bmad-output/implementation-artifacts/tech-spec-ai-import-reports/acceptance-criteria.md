# Acceptance Criteria

**AC1:** User paste Slack text → click "Parse with AI 🤖" → thấy preview table với đúng data đã parse

**AC2:** LLM parse handle bất kỳ format nào (Slack, Discord, MS Teams...)

**AC3:** Unmapped authors → yellow badge → inline dropdown mapping

**AC4:** Mapping persist trong localStorage → import lần sau tự động apply

**AC5:** Owner chọn Skip (default) hoặc Overwrite trước khi import

**AC6:** Import button disabled khi còn unmapped author chưa được map

**AC7:** Owner có thể chọn "Import only mapped" → skip unmapped → warning hiện số reports bị skip

**AC8:** Upsert: skip → không ghi đè data hiện có; overwrite → xóa + insert mới

**AC9:** Audit log ghi: ai import, bao nhiêu rows, mode, thời gian

**AC10:** LLM parse fail → hiện error + "Retry" button, không crash UI

**AC11:** Sidebar hiện "Import" link chỉ khi role = owner hoặc manager

**AC12:** Hours logged = tổng hours tất cả tasks (completed + in_progress)

**AC13:** Empty sections (N/A) → không tạo task row

**AC14:** Nếu tất cả reports đều unmapped → Import button disabled + message: "Không có report nào được map. Vui lòng map author trước khi import."
