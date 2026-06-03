export type Country = { name: string; iso2: string; dial: string };

/** Converte o ISO2 do país no emoji da bandeira (🇧🇷, 🇵🇹, ...). */
export function flagEmoji(iso2: string) {
  return iso2
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

// Brasil primeiro; demais em ordem alfabética (pt-BR).
export const COUNTRIES: Country[] = [
  { name: "Brasil", iso2: "BR", dial: "55" },
  { name: "Alemanha", iso2: "DE", dial: "49" },
  { name: "Angola", iso2: "AO", dial: "244" },
  { name: "Argentina", iso2: "AR", dial: "54" },
  { name: "Austrália", iso2: "AU", dial: "61" },
  { name: "Áustria", iso2: "AT", dial: "43" },
  { name: "Bélgica", iso2: "BE", dial: "32" },
  { name: "Bolívia", iso2: "BO", dial: "591" },
  { name: "Cabo Verde", iso2: "CV", dial: "238" },
  { name: "Canadá", iso2: "CA", dial: "1" },
  { name: "Chile", iso2: "CL", dial: "56" },
  { name: "China", iso2: "CN", dial: "86" },
  { name: "Colômbia", iso2: "CO", dial: "57" },
  { name: "Coreia do Sul", iso2: "KR", dial: "82" },
  { name: "Costa Rica", iso2: "CR", dial: "506" },
  { name: "Dinamarca", iso2: "DK", dial: "45" },
  { name: "Emirados Árabes Unidos", iso2: "AE", dial: "971" },
  { name: "Equador", iso2: "EC", dial: "593" },
  { name: "Espanha", iso2: "ES", dial: "34" },
  { name: "Estados Unidos", iso2: "US", dial: "1" },
  { name: "Finlândia", iso2: "FI", dial: "358" },
  { name: "França", iso2: "FR", dial: "33" },
  { name: "Grécia", iso2: "GR", dial: "30" },
  { name: "Guatemala", iso2: "GT", dial: "502" },
  { name: "Holanda", iso2: "NL", dial: "31" },
  { name: "Índia", iso2: "IN", dial: "91" },
  { name: "Irlanda", iso2: "IE", dial: "353" },
  { name: "Israel", iso2: "IL", dial: "972" },
  { name: "Itália", iso2: "IT", dial: "39" },
  { name: "Japão", iso2: "JP", dial: "81" },
  { name: "México", iso2: "MX", dial: "52" },
  { name: "Moçambique", iso2: "MZ", dial: "258" },
  { name: "Noruega", iso2: "NO", dial: "47" },
  { name: "Nova Zelândia", iso2: "NZ", dial: "64" },
  { name: "Panamá", iso2: "PA", dial: "507" },
  { name: "Paraguai", iso2: "PY", dial: "595" },
  { name: "Peru", iso2: "PE", dial: "51" },
  { name: "Polônia", iso2: "PL", dial: "48" },
  { name: "Portugal", iso2: "PT", dial: "351" },
  { name: "Reino Unido", iso2: "GB", dial: "44" },
  { name: "Suécia", iso2: "SE", dial: "46" },
  { name: "Suíça", iso2: "CH", dial: "41" },
  { name: "Uruguai", iso2: "UY", dial: "598" },
  { name: "Venezuela", iso2: "VE", dial: "58" },
  { name: "África do Sul", iso2: "ZA", dial: "27" },
];

export const DEFAULT_COUNTRY: Country = COUNTRIES[0];
