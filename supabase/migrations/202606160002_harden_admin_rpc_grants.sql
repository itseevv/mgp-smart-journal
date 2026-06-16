revoke all on function public.is_capsule_fulfillment_disabled(uuid)
from public, anon, authenticated;

revoke all on function public.admin_generate_capsule_batch(
  text, public.capsule_product_type, integer, text, text, text
) from public, anon, authenticated;

revoke all on function public.admin_list_capsules(
  public.capsule_product_type,
  uuid,
  public.capsule_fulfillment_status,
  text
) from public, anon, authenticated;

revoke all on function public.admin_get_capsule_detail(uuid)
from public, anon, authenticated;

revoke all on function public.admin_update_capsule_fulfillment(
  uuid, text, text, boolean, text
) from public, anon, authenticated;

grant execute on function public.is_capsule_fulfillment_disabled(uuid)
to service_role;

grant execute on function public.admin_generate_capsule_batch(
  text, public.capsule_product_type, integer, text, text, text
) to service_role;

grant execute on function public.admin_list_capsules(
  public.capsule_product_type,
  uuid,
  public.capsule_fulfillment_status,
  text
) to service_role;

grant execute on function public.admin_get_capsule_detail(uuid)
to service_role;

grant execute on function public.admin_update_capsule_fulfillment(
  uuid, text, text, boolean, text
) to service_role;
