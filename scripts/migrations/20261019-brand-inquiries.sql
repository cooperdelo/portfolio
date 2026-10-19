-- Brand / UGC inquiries from cooperdelo.com/brands. NOT APPLIED YET (the apply was declined on 2026-10-19; Cooper's call).
-- Without it, inquiries still save and show in the admin Messages card (Portfolio visitors); this only adds the to-do.
-- The form posts to /api/contact (service role, server side). Anon still has no grant on site_messages, and the
-- existing site_messages_full + limited_role_boundary policies are unchanged.
-- What this adds: every inquiry with kind 'Brand or UGC' also lands in command_center, so it shows up under
-- "What needs you" in the admin with the reply address, and nobody has to remember to check the Messages card.
create or replace function public.site_message_to_command_center()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'Brand or UGC' then
    insert into public.command_center (kind, title, body, priority, due, source_task, source_path, context)
    values (
      'do',
      left('Reply to brand inquiry: ' || new.name, 80),
      left('Reply to ' || new.reply || '. ' || regexp_replace(new.message, '\s+', ' ', 'g'), 240),
      8,
      now() + interval '1 day',
      'brands-form',
      'site_messages#' || new.id,
      'From cooperdelo.com/brands. Full message: admin Portfolio visitors > Messages.'
    );
  end if;
  return new;
end $$;
revoke all on function public.site_message_to_command_center() from public, anon, authenticated;

drop trigger if exists site_message_to_command_center on public.site_messages;
create trigger site_message_to_command_center after insert on public.site_messages
  for each row execute function public.site_message_to_command_center();
