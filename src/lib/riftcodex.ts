// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiftcodexCardAttributes {
  energy: number | null;
  might: number | null;
  power: number | null;
}

export interface RiftcodexCardClassification {
  type: string;
  supertype: string | null;
  rarity: string;
  domain: string[];
}

export interface RiftcodexCardText {
  rich: string;
  plain: string;
}

export interface RiftcodexCardSet {
  id: string;
  label: string;
}

export interface RiftcodexCardMedia {
  image_url: string;
  artist: string;
  accessibility_text: string;
}

export interface RiftcodexCardMetadata {
  alternate_art: boolean;
  overnumbered: boolean;
  signature: boolean;
}

export interface RiftcodexCard {
  name: string;
  id: string;
  riftbound_id: string;
  tcgplayer_id: string | null;
  public_code: string;
  collector_number: number;
  attributes: RiftcodexCardAttributes;
  classification: RiftcodexCardClassification;
  text: RiftcodexCardText;
  set: RiftcodexCardSet;
  media: RiftcodexCardMedia;
  tags: string[];
  orientation: string;
  metadata: RiftcodexCardMetadata;
}

export interface RiftcodexSet {
  id: string;
  label: string;
}

/** Raw shape returned by the Riftcodex API */
export interface RiftcodexCardsAPIResponse {
  items: RiftcodexCard[];
  total: number;
  page: number;
  size: number;   // items per page
  pages: number;  // total pages
}

/** Normalised shape used throughout the app */
export interface RiftcodexCardsResponse {
  cards: RiftcodexCard[];
  total: number;
  page: number;
  limit: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = "https://api.riftcodex.com";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 }, // cache for 1h on the server
  });
  if (!res.ok) {
    throw new Error(`Riftcodex API error ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

/** Fetch a paginated list of all cards */
export async function getCards(
  page = 1,
  limit = 20
): Promise<RiftcodexCardsResponse> {
  const raw = await apiFetch<RiftcodexCardsAPIResponse>(
    `/cards?page=${page}&size=${limit}`
  );
  // Normalise: API uses `items`, we expose `cards`
  return { cards: raw.items, total: raw.total, page: raw.page, limit: raw.size };
}

/** Search cards by name or text query */
export async function searchCards(
  query: string,
  page = 1,
  limit = 20
): Promise<RiftcodexCardsResponse> {
  const encoded = encodeURIComponent(query);
  const raw = await apiFetch<RiftcodexCardsAPIResponse>(
    `/cards/search?query=${encoded}&page=${page}&size=${limit}`
  );
  return { cards: raw.items, total: raw.total, page: raw.page, limit: raw.size };
}

/** Get a single card by its Riftcodex UUID */
export async function getCardById(id: string): Promise<RiftcodexCard> {
  return apiFetch<RiftcodexCard>(`/cards/${id}`);
}

/** Get cards matching an exact name */
export async function getCardsByName(name: string): Promise<RiftcodexCard[]> {
  const encoded = encodeURIComponent(name);
  return apiFetch<RiftcodexCard[]>(`/cards/name/${encoded}`);
}

/** Fetch all sets */
export async function getSets(): Promise<RiftcodexSet[]> {
  return apiFetch<RiftcodexSet[]>("/sets");
}
