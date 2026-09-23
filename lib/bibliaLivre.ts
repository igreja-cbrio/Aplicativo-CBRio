export type LivroBiblico = { nome: string; api: string; capitulos: number };
export type VersiculoLivre = { book_name: string; chapter: number; verse: number; text: string };
export type VersaoBiblica = { id: string; sigla: string; nome: string; idioma: string };
export const VERSOES_BIBLIA: VersaoBiblica[] = [
  { id: "almeida", sigla: "JFA", nome: "João Ferreira de Almeida", idioma: "Português" },
  { id: "web", sigla: "WEB", nome: "World English Bible", idioma: "English" },
  { id: "kjv", sigla: "KJV", nome: "King James Version", idioma: "English" },
];

export const LIVROS_BIBLIA: LivroBiblico[] = [
  { nome: "Gênesis", api: "Genesis", capitulos: 50 }, { nome: "Êxodo", api: "Exodus", capitulos: 40 },
  { nome: "Levítico", api: "Leviticus", capitulos: 27 }, { nome: "Números", api: "Numbers", capitulos: 36 },
  { nome: "Deuteronômio", api: "Deuteronomy", capitulos: 34 }, { nome: "Josué", api: "Joshua", capitulos: 24 },
  { nome: "Juízes", api: "Judges", capitulos: 21 }, { nome: "Rute", api: "Ruth", capitulos: 4 },
  { nome: "1 Samuel", api: "1 Samuel", capitulos: 31 }, { nome: "2 Samuel", api: "2 Samuel", capitulos: 24 },
  { nome: "1 Reis", api: "1 Kings", capitulos: 22 }, { nome: "2 Reis", api: "2 Kings", capitulos: 25 },
  { nome: "1 Crônicas", api: "1 Chronicles", capitulos: 29 }, { nome: "2 Crônicas", api: "2 Chronicles", capitulos: 36 },
  { nome: "Esdras", api: "Ezra", capitulos: 10 }, { nome: "Neemias", api: "Nehemiah", capitulos: 13 },
  { nome: "Ester", api: "Esther", capitulos: 10 }, { nome: "Jó", api: "Job", capitulos: 42 },
  { nome: "Salmos", api: "Psalms", capitulos: 150 }, { nome: "Provérbios", api: "Proverbs", capitulos: 31 },
  { nome: "Eclesiastes", api: "Ecclesiastes", capitulos: 12 }, { nome: "Cânticos", api: "Song of Solomon", capitulos: 8 },
  { nome: "Isaías", api: "Isaiah", capitulos: 66 }, { nome: "Jeremias", api: "Jeremiah", capitulos: 52 },
  { nome: "Lamentações", api: "Lamentations", capitulos: 5 }, { nome: "Ezequiel", api: "Ezekiel", capitulos: 48 },
  { nome: "Daniel", api: "Daniel", capitulos: 12 }, { nome: "Oseias", api: "Hosea", capitulos: 14 },
  { nome: "Joel", api: "Joel", capitulos: 3 }, { nome: "Amós", api: "Amos", capitulos: 9 },
  { nome: "Obadias", api: "Obadiah", capitulos: 1 }, { nome: "Jonas", api: "Jonah", capitulos: 4 },
  { nome: "Miqueias", api: "Micah", capitulos: 7 }, { nome: "Naum", api: "Nahum", capitulos: 3 },
  { nome: "Habacuque", api: "Habakkuk", capitulos: 3 }, { nome: "Sofonias", api: "Zephaniah", capitulos: 3 },
  { nome: "Ageu", api: "Haggai", capitulos: 2 }, { nome: "Zacarias", api: "Zechariah", capitulos: 14 },
  { nome: "Malaquias", api: "Malachi", capitulos: 4 }, { nome: "Mateus", api: "Matthew", capitulos: 28 },
  { nome: "Marcos", api: "Mark", capitulos: 16 }, { nome: "Lucas", api: "Luke", capitulos: 24 },
  { nome: "João", api: "John", capitulos: 21 }, { nome: "Atos", api: "Acts", capitulos: 28 },
  { nome: "Romanos", api: "Romans", capitulos: 16 }, { nome: "1 Coríntios", api: "1 Corinthians", capitulos: 16 },
  { nome: "2 Coríntios", api: "2 Corinthians", capitulos: 13 }, { nome: "Gálatas", api: "Galatians", capitulos: 6 },
  { nome: "Efésios", api: "Ephesians", capitulos: 6 }, { nome: "Filipenses", api: "Philippians", capitulos: 4 },
  { nome: "Colossenses", api: "Colossians", capitulos: 4 }, { nome: "1 Tessalonicenses", api: "1 Thessalonians", capitulos: 5 },
  { nome: "2 Tessalonicenses", api: "2 Thessalonians", capitulos: 3 }, { nome: "1 Timóteo", api: "1 Timothy", capitulos: 6 },
  { nome: "2 Timóteo", api: "2 Timothy", capitulos: 4 }, { nome: "Tito", api: "Titus", capitulos: 3 },
  { nome: "Filemom", api: "Philemon", capitulos: 1 }, { nome: "Hebreus", api: "Hebrews", capitulos: 13 },
  { nome: "Tiago", api: "James", capitulos: 5 }, { nome: "1 Pedro", api: "1 Peter", capitulos: 5 },
  { nome: "2 Pedro", api: "2 Peter", capitulos: 3 }, { nome: "1 João", api: "1 John", capitulos: 5 },
  { nome: "2 João", api: "2 John", capitulos: 1 }, { nome: "3 João", api: "3 John", capitulos: 1 },
  { nome: "Judas", api: "Jude", capitulos: 1 }, { nome: "Apocalipse", api: "Revelation", capitulos: 22 },
];

export async function carregarCapitulo(livro: LivroBiblico, capitulo: number, versao = "almeida"): Promise<VersiculoLivre[]> {
  const referencia = encodeURIComponent(livro.api + " " + capitulo);
  const resposta = await fetch("https://bible-api.com/" + referencia + "?translation=" + encodeURIComponent(versao));
  if (!resposta.ok) throw new Error("Não foi possível carregar este capítulo.");
  const json = await resposta.json() as { verses?: VersiculoLivre[] };
  return json.verses ?? [];
}
