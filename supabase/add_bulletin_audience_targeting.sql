alter table bulletins add column if not exists target_all_psychologists boolean default true;
alter table bulletins add column if not exists target_all_officers boolean default true;
alter table bulletins add column if not exists target_psychologist_ids uuid[] default '{}';
alter table bulletins add column if not exists target_departments text[] default '{}';
