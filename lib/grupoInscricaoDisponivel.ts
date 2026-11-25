type DisponibilidadeGrupos = {
  aberta: boolean;
  falhou?: boolean;
  grupos: readonly { id: string }[];
};

export function grupoAbertoParaInscricao(disponibilidade: DisponibilidadeGrupos, grupoId: string): boolean {
  return !disponibilidade.falhou && disponibilidade.aberta
    && disponibilidade.grupos.some((grupo) => grupo.id === grupoId);
}
