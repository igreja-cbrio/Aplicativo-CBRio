export function destinoAvisoKids(data: Record<string, unknown>) {
  const id = data.aviso_id;
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? { pathname: "/kids-mural" as const, params: { aviso: id } }
    : { pathname: "/kids-mural" as const };
}
