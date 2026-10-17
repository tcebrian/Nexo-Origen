-- Eliminar un contacto de Conversations por completo (botón "Eliminar contacto" de la ficha).
--
-- Varias claves foráneas son RESTRICT (contacto→conversaciones, contacto→empresas, mensajes→conversación,
-- restaurantes→empresas del contacto), así que no sirve un DELETE directo sobre conv_contactos. Esta función
-- borra de hijos a padres en UNA sola transacción (una función plpgsql es atómica: si cualquier paso falla se
-- revierte todo, sin borrados parciales):
--
--   1. conv_contacto_restaurantes   (depende de conv_contacto_empresas)
--   2. conv_contacto_empresas
--   3. conv_informe_envios          (CASCADE; sus mensajes/conversación quedarían a NULL)
--   4. conv_alertas_negativas       (CASCADE; su conversación quedaría a NULL)
--   5. conv_mensajes                (de TODAS las conversaciones del contacto; RESTRICT hacia la conversación)
--   6. conv_conversaciones          (RESTRICT hacia el contacto)
--   7. conv_contactos
--
-- NO toca auth.users, perfiles, empresas, restaurantes, reseñas ni datos de otros contactos. Si el contacto
-- estaba vinculado a una cuenta web (`usuario_id`), la cuenta web sigue intacta.
-- Devuelve los nº de filas borradas por tabla. Error P0002 si el contacto no existe.
-- Solo service_role (como nexo_set_contact_access). Idempotente.
create or replace function public.nexo_delete_contact(p_contacto_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_restaurantes int;
  v_empresas int;
  v_informes int;
  v_alertas int;
  v_mensajes int;
  v_conversaciones int;
begin
  -- Bloquea al contacto: ninguna otra operación lo modifica mientras se borra.
  perform 1 from public.conv_contactos where id = p_contacto_id for update;
  if not found then
    raise exception 'contacto no encontrado' using errcode = 'P0002';
  end if;

  delete from public.conv_contacto_restaurantes where contacto_id = p_contacto_id;
  get diagnostics v_restaurantes = row_count;

  delete from public.conv_contacto_empresas where contacto_id = p_contacto_id;
  get diagnostics v_empresas = row_count;

  delete from public.conv_informe_envios where contacto_id = p_contacto_id;
  get diagnostics v_informes = row_count;

  delete from public.conv_alertas_negativas where contacto_id = p_contacto_id;
  get diagnostics v_alertas = row_count;

  delete from public.conv_mensajes
   where conversacion_id in (select id from public.conv_conversaciones where contacto_id = p_contacto_id);
  get diagnostics v_mensajes = row_count;

  delete from public.conv_conversaciones where contacto_id = p_contacto_id;
  get diagnostics v_conversaciones = row_count;

  delete from public.conv_contactos where id = p_contacto_id;

  return jsonb_build_object(
    'contacto_restaurantes', v_restaurantes,
    'contacto_empresas', v_empresas,
    'informe_envios', v_informes,
    'alertas_negativas', v_alertas,
    'mensajes', v_mensajes,
    'conversaciones', v_conversaciones,
    'contactos', 1
  );
end;
$function$;

revoke all on function public.nexo_delete_contact(uuid) from public, anon, authenticated;
grant execute on function public.nexo_delete_contact(uuid) to service_role;

comment on function public.nexo_delete_contact(uuid) is
  'Borra un contacto de Conversations y todo lo suyo (permisos, mensajes, conversaciones, alertas, informes) en una transacción. No toca auth ni perfiles.';
