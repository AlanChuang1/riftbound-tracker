import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCardById } from "@/lib/riftcodex";

// ─── Attribute chip ────────────────────────────────────────────────────────────
function AttrChip({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: string | number | null;
}) {
  if (value === null || value === undefined) return null;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "0.6rem 1rem",
        minWidth: 72,
        gap: 2,
      }}
    >
      <span style={{ fontSize: "1.2rem" }}>{emoji}</span>
      <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
        {value}
      </span>
      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Rarity color map ──────────────────────────────────────────────────────────
const DOMAIN_COLORS: Record<string, string> = {
  Chaos: "#f472b6",
  Order: "#60a5fa",
  Nature: "#34d399",
  Tech: "#fbbf24",
  Spirit: "#a78bfa",
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let card;
  try {
    card = await getCardById(id);
  } catch {
    notFound();
  }

  const rarityColor: Record<string, string> = {
    Common: "var(--rarity-common)",
    Uncommon: "var(--rarity-uncommon)",
    Rare: "var(--rarity-rare)",
    Legendary: "var(--rarity-legendary)",
    Mythic: "var(--rarity-mythic)",
  };
  const rc = rarityColor[card.classification.rarity] ?? "var(--text-dim)";

  return (
    <div style={{ minHeight: "100vh", padding: "2rem 1.25rem 5rem" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Back */}
        <Link href="/cards" className="btn-ghost" style={{ marginBottom: "1.75rem", display: "inline-flex" }}>
          ← Back to Cards
        </Link>

        {/* Layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 320px) 1fr",
            gap: "2.5rem",
            alignItems: "start",
            marginTop: "1.5rem",
          }}
        >
          {/* Card image */}
          <div>
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "744 / 1039",
                borderRadius: 18,
                overflow: "hidden",
                border: "1px solid var(--border)",
                boxShadow: "0 12px 60px rgba(0,0,0,0.6)",
              }}
            >
              <Image
                src={card.media.image_url}
                alt={card.media.accessibility_text || card.name}
                fill
                sizes="320px"
                style={{ objectFit: "cover" }}
                unoptimized
                priority
              />
            </div>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                textAlign: "center",
                marginTop: "0.6rem",
              }}
            >
              Art by {card.media.artist}
            </p>
          </div>

          {/* Details */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Name + code */}
            <div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                  marginBottom: 6,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                {card.public_code} · {card.set.label}
              </div>
              <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", margin: 0 }}>{card.name}</h1>
            </div>

            {/* Classification */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span
                className="pill"
                style={{ color: rc, borderColor: `${rc}55`, fontSize: "0.75rem" }}
              >
                {card.classification.rarity}
              </span>
              <span className="pill" style={{ fontSize: "0.75rem" }}>
                {card.classification.type}
              </span>
              {card.classification.supertype && (
                <span className="pill" style={{ fontSize: "0.75rem" }}>
                  {card.classification.supertype}
                </span>
              )}
              {card.classification.domain.map((d) => (
                <span
                  key={d}
                  className="pill"
                  style={{
                    color: DOMAIN_COLORS[d] ?? "var(--text-dim)",
                    borderColor: DOMAIN_COLORS[d] ? `${DOMAIN_COLORS[d]}44` : undefined,
                    fontSize: "0.75rem",
                  }}
                >
                  {d}
                </span>
              ))}
            </div>

            {/* Attributes */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <AttrChip emoji="⚡" label="Energy" value={card.attributes.energy} />
              <AttrChip emoji="⚔️" label="Might" value={card.attributes.might} />
              <AttrChip emoji="💪" label="Power" value={card.attributes.power} />
            </div>

            {/* Card text */}
            {card.text.plain && (
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "1rem 1.25rem",
                }}
              >
                <p
                  style={{
                    fontSize: "0.9rem",
                    lineHeight: 1.7,
                    color: "var(--text-dim)",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {card.text.plain}
                </p>
              </div>
            )}

            {/* Tags */}
            {card.tags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {card.tags.map((t) => (
                  <span key={t} className="pill">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Metadata footer */}
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                borderTop: "1px solid var(--border)",
                paddingTop: "1rem",
                display: "flex",
                gap: "1.5rem",
                flexWrap: "wrap",
              }}
            >
              <span>Riftbound ID: {card.riftbound_id}</span>
              {card.tcgplayer_id && (
                <a
                  href={`https://www.tcgplayer.com/product/${card.tcgplayer_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "var(--accent-2)", textDecoration: "none" }}
                >
                  View on TCGPlayer ↗
                </a>
              )}
              {card.metadata.alternate_art && (
                <span style={{ color: "var(--gold)" }}>✦ Alternate Art</span>
              )}
              {card.metadata.signature && (
                <span style={{ color: "var(--accent-2)" }}>✍ Signature</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
