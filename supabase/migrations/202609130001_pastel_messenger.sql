-- 파스텔 메신저: 1:1 채팅, 읽음 상태, 비공개 첨부파일
create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  direct_key varchar(73) not null unique,
  created_by uuid references public.employees(id) on delete set null,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_rooms_direct_key_length check (char_length(direct_key) = 73)
);

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (room_id, employee_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid references public.employees(id) on delete set null,
  content text,
  attachment_path text,
  attachment_name varchar(255),
  attachment_mime_type varchar(150),
  attachment_size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint chat_messages_content_length check (content is null or char_length(content) between 1 and 3000),
  constraint chat_messages_payload_check check (content is not null or attachment_path is not null),
  constraint chat_messages_attachment_fields_check check (
    (attachment_path is null and attachment_name is null and attachment_mime_type is null and attachment_size_bytes is null)
    or
    (attachment_path is not null and attachment_name is not null and attachment_mime_type is not null and attachment_size_bytes between 1 and 4194304)
  )
);

create index if not exists chat_room_members_employee_idx
  on public.chat_room_members (employee_id, room_id);
create index if not exists chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at desc);

drop trigger if exists chat_rooms_set_updated_at on public.chat_rooms;
create trigger chat_rooms_set_updated_at
before update on public.chat_rooms
for each row execute function public.set_updated_at();

alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.chat_messages enable row level security;
revoke all on table public.chat_rooms from anon, authenticated;
revoke all on table public.chat_room_members from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-attachments', 'chat-attachments', false, 4194304, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

