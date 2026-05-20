-- Migrate legacy workspace_holidays data into calendar_events
-- Idempotent: safe to run multiple times (skips if table doesn't exist)

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'workspace_holidays') then
    insert into calendar_events (
      workspace_id, event_type, title, start_date, end_date,
      capacity_impact, is_recurring, recurrence_rule,
      auto_generated, source_table, source_id, timezone
    )
    select
      wh.workspace_id,
      case wh.type
        when 'festival' then 'festival'
        when 'company' then 'company'
        else 'holiday'
      end,
      wh.name,
      wh.date::text || 'T00:00:00Z',
      wh.date::text || 'T23:59:59Z',
      1,
      true,
      'FREQ=YEARLY',
      true,
      'legacy_workspace_holidays',
      wh.id::text,
      'UTC'
    from workspace_holidays wh
    where not exists (
      select 1 from calendar_events ce
      where ce.workspace_id = wh.workspace_id
        and ce.source_table = 'legacy_workspace_holidays'
    )
    on conflict do nothing;
  end if;
end;
$$;
