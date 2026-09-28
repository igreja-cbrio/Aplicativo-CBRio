export function kidsPodePreparar(filho: {participa_campus?: boolean}) {
  return filho.participa_campus === true;
}
export function kidsContextoMudou(error: unknown) {
  return (error as {code?:string}|null)?.code === 'CAMPUS_CONTEXT_CHANGED';
}
