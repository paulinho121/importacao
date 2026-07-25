-- Reseta o schema "public" do Supabase por completo (tabelas, enums,
-- sequences, funções, views) e restaura as permissões padrão que o
-- Supabase (PostgREST/auth) espera encontrar nesse schema.
--
-- Rode isso no Supabase Dashboard -> SQL Editor -> New query.
-- Não afeta os schemas internos do Supabase (auth, storage, realtime, etc).

drop schema public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all functions in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
