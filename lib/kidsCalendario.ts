export function diasDoMesKids(mes: string): (string | null)[] {
  const [ano, numero] = mes.split("-").map(Number);
  const inicio = new Date(ano, numero - 1, 1).getDay();
  const total = new Date(ano, numero, 0).getDate();
  return [...Array(inicio).fill(null), ...Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
}
export function moverMesKids(mes: string, direcao: number) {
  const [ano, numero] = mes.split("-").map(Number);
  const data = new Date(ano, numero - 1 + direcao, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}
