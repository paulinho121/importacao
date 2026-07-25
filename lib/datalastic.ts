// Integração com a Datalastic (https://datalastic.com), API paga por
// consulta — nunca chamar isso automaticamente em cada carregamento de
// página. Só usado a partir de refreshVesselPosition (Server Action),
// disparado manualmente pelo usuário.

const BASE_URL = "https://api.datalastic.com/api/v0/vessel";

export type VesselPosition = {
  name: string | null;
  lat: number;
  lon: number;
  speedKnots: number | null;
  heading: number | null;
  destination: string | null;
};

export type VesselFetchResult =
  | { ok: true; data: VesselPosition }
  | { ok: false; error: string };

export async function fetchVesselPosition(params: {
  imo?: string | null;
  mmsi?: string | null;
}): Promise<VesselFetchResult> {
  const apiKey = process.env.DATALASTIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "DATALASTIC_API_KEY não definida. Preencha em .env.local (crie uma conta em datalastic.com).",
    };
  }
  if (!params.imo && !params.mmsi) {
    return { ok: false, error: "Informe o IMO ou o MMSI do navio." };
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("api-key", apiKey);
  if (params.imo) url.searchParams.set("imo", params.imo);
  else if (params.mmsi) url.searchParams.set("mmsi", params.mmsi);

  let response: Response;
  try {
    response = await fetch(url.toString(), { cache: "no-store" });
  } catch {
    return { ok: false, error: "Falha de rede ao consultar a Datalastic." };
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "API key da Datalastic inválida ou sem créditos." };
    }
    if (response.status === 404) {
      return { ok: false, error: "Navio não encontrado para esse IMO/MMSI." };
    }
    return { ok: false, error: `Datalastic retornou erro (HTTP ${response.status}).` };
  }

  const body = await response.json();
  const vessel = body?.data ?? body;
  if (!vessel || typeof vessel.lat !== "number" || typeof vessel.lon !== "number") {
    return { ok: false, error: "Datalastic não retornou uma posição válida para esse navio." };
  }

  return {
    ok: true,
    data: {
      name: vessel.name ?? null,
      lat: vessel.lat,
      lon: vessel.lon,
      speedKnots: typeof vessel.speed === "number" ? vessel.speed : null,
      heading:
        typeof vessel.heading === "number"
          ? vessel.heading
          : typeof vessel.course === "number"
            ? vessel.course
            : null,
      destination: vessel.destination ?? null,
    },
  };
}
