# Additional Context

## Dependencies

- `zod` — schema validation (đã có trong project)
- `OpenAI API key` — cần set trong Supabase dashboard secrets
- Không cần thêm package mới

## API Keys

```
OPENAI_API_KEY=sk-...  # set in Supabase Edge Function secrets
```

## Testing Strategy

- **LLM output validation**: mock LLM response, test Zod schema parse
- **User mapping unit tests**: mock users array, test matching logic
- **localStorage persistence tests**: test save/load mapping
- **RPC integration test**: mock DB, test upsert logic
- **E2E**: paste real Slack text → verify DB rows

## Notes

- Sample chat export: `/Users/mac/Documents/my-projects/TekSpace/slack.txt` (Slack export)
- Team Tekmium: 6 members trong DB
- Claude Haiku (cheapest model) đủ cho parsing task — không cần Claude Sonnet
- Edge Function timeout: set 30s cho LLM call
- Feature sẵn sàng mở rộng Discord/MS Teams export trong tương lai — chỉ cần paste text, LLM parse
