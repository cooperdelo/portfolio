// =====================================================================
// notion-mirror — Supabase Edge Function
// Mirrors financial_transactions rows into the Notion Financial Command
// Center database (collection aaee8a52-3c63-4b90-8308-ca8cd7adf9fe).
//
// Fires on database webhooks (configured below). Idempotent: if a row
// has notion_page_id, we PATCH that page; otherwise we POST a new one.
// On DELETE we archive the Notion page.
//
// Deploy:
//   supabase functions deploy notion-mirror --no-verify-jwt
//   supabase secrets set NOTION_API_KEY=secret_XXXXX
//   supabase secrets set NOTION_DB_ID=aaee8a52-3c63-4b90-8308-ca8cd7adf9fe
//
// Wire trigger (see ./trigger.sql in this folder).
// =====================================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const NOTION_API_KEY = Deno.env.get('NOTION_API_KEY')!;
const NOTION_DB_ID   = Deno.env.get('NOTION_DB_ID')!;
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

interface TxRow {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  entity: string;
  account?: string | null;
  category: string;
  is_tax_deductible?: boolean | null;
  is_food_log?: boolean | null;
  funded_by?: string | null;
  merchant?: string | null;
  notes?: string | null;
  notion_page_id?: string | null;
  deleted_at?: string | null;
}

const notionHeaders = {
  'Authorization': `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

function rowToProperties(r: TxRow) {
  // Adjust property names below to match the Notion DB schema.
  const signed = r.type === 'income' ? Number(r.amount) : -Number(r.amount);
  return {
    'Name':         { title: [{ text: { content: r.description.slice(0, 200) } }] },
    'Date':         { date: { start: r.date } },
    'Amount':       { number: Number(r.amount) },
    'Signed':       { number: signed },
    'Type':         { select: { name: r.type } },
    'Entity':       { select: { name: r.entity } },
    'Category':     { select: { name: r.category || 'uncategorized' } },
    'Account':      r.account     ? { select: { name: r.account } } : { select: null },
    'Funded By':    r.funded_by   ? { select: { name: r.funded_by } } : { select: null },
    'Merchant':     { rich_text: r.merchant ? [{ text: { content: r.merchant.slice(0, 200) } }] : [] },
    'Notes':        { rich_text: r.notes ? [{ text: { content: r.notes.slice(0, 2000) } }] : [] },
    'Tax Deduct':   { checkbox: !!r.is_tax_deductible },
    'Food Log':     { checkbox: !!r.is_food_log },
    'Supabase ID':  { rich_text: [{ text: { content: r.id } }] },
  };
}

async function createNotionPage(r: TxRow): Promise<string> {
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: notionHeaders,
    body: JSON.stringify({
      parent: { database_id: NOTION_DB_ID },
      properties: rowToProperties(r),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Notion create failed: ${JSON.stringify(json)}`);
  return json.id;
}

async function updateNotionPage(pageId: string, r: TxRow) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders,
    body: JSON.stringify({ properties: rowToProperties(r) }),
  });
  if (!res.ok) throw new Error(`Notion update failed: ${JSON.stringify(await res.json())}`);
}

async function archiveNotionPage(pageId: string) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders,
    body: JSON.stringify({ archived: true }),
  });
  if (!res.ok) throw new Error(`Notion archive failed: ${JSON.stringify(await res.json())}`);
}

serve(async (req) => {
  try {
    const payload = await req.json();
    const { type, record, old_record } = payload as {
      type: 'INSERT' | 'UPDATE' | 'DELETE';
      record?: TxRow;
      old_record?: TxRow;
    };

    if (type === 'DELETE') {
      const pageId = old_record?.notion_page_id;
      if (pageId) await archiveNotionPage(pageId);
      return new Response('ok');
    }

    const row = record!;

    // Soft-deletes also archive the Notion page
    if (row.deleted_at) {
      if (row.notion_page_id) await archiveNotionPage(row.notion_page_id);
      return new Response('ok-soft-deleted');
    }

    if (row.notion_page_id) {
      await updateNotionPage(row.notion_page_id, row);
    } else {
      const pageId = await createNotionPage(row);
      // Write pageId back so future updates know which page to patch.
      // Use service role to bypass RLS for this update.
      await sb.from('financial_transactions').update({ notion_page_id: pageId }).eq('id', row.id);
    }

    return new Response('ok');
  } catch (e) {
    console.error(e);
    return new Response(`err: ${(e as Error).message}`, { status: 500 });
  }
});
