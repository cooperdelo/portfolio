# notion-mirror

One-way sync: Supabase `financial_transactions` → Notion Financial Command Center.

## Deploy (one-time)

1. Get a Notion integration token:
   - notion.so/my-integrations → "New integration" → copy `secret_…` token
   - Share the Financial Command Center DB with the integration (page menu → Connections → add your integration)

2. From `F:\Github\Portfolio\admin\finance\_supabase\`:

   ```bash
   supabase login
   supabase link --project-ref yhemvsksnoojplnxirlv
   supabase secrets set NOTION_API_KEY=secret_XXXXXXXX
   supabase secrets set NOTION_DB_ID=aaee8a52-3c63-4b90-8308-ca8cd7adf9fe
   supabase functions deploy notion-mirror --no-verify-jwt
   ```

3. Wire the webhook (Supabase Dashboard → Database → Webhooks → New webhook):
   - Name: `notion-mirror`
   - Table: `financial_transactions`
   - Events: Insert · Update · Delete
   - Type: HTTP Request
   - Method: POST
   - URL: `https://yhemvsksnoojplnxirlv.functions.supabase.co/notion-mirror`
   - HTTP Headers: `Content-Type: application/json`

4. Backfill existing rows (one-time):

   ```sql
   -- This triggers the webhook for every active row, mirroring them
   UPDATE financial_transactions SET updated_at = now() WHERE deleted_at IS NULL;
   ```

## Property mapping

| Supabase column      | Notion property name |
|----------------------|----------------------|
| description          | Name (title)         |
| date                 | Date                 |
| amount               | Amount               |
| amount (signed)      | Signed               |
| type                 | Type (select)        |
| entity               | Entity (select)      |
| category             | Category (select)    |
| account              | Account (select)     |
| funded_by            | Funded By (select)   |
| merchant             | Merchant (text)      |
| notes                | Notes (text)         |
| is_tax_deductible    | Tax Deduct (checkbox)|
| is_food_log          | Food Log (checkbox)  |
| id                   | Supabase ID (text)   |

If your Notion DB uses different property names, edit `rowToProperties()` in `index.ts`.
