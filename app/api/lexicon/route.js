// app/api/lexicon/route.js
import Airtable from "airtable";

const { AIRTABLE_ACCESS_TOKEN, AIRTABLE_BASE_ID, LEXICON_TABLE } = process.env;
const CORS = process.env.CORS_ALLOW_ORIGIN || "*";
const base = new Airtable({ apiKey: AIRTABLE_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

// stringify helper (handles arrays and {value,state})
const toStr = (v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(toStr).join(" ");
  if (typeof v === "object" && "value" in v) return String(v.value ?? "");
  try { return JSON.stringify(v); } catch { return ""; }
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const qRaw = (searchParams.get("q") || "").trim();
    const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    // Search across ctpv + Canonical Term + Shortcode + Definition
    const concat = `CONCATENATE("" & {ctpv}, " ", "" & {Canonical Term}, " ", "" & {Shortcode}, " ", "" & {Definition})`;
    const filterByFormula = qRaw ? `FIND(LOWER("${esc(qRaw)}"), LOWER(${concat})) > 0` : undefined;

    // Ask Airtable to return only the three fields we need
    const selectOpts = {
      ...(filterByFormula ? { filterByFormula } : {}),
      fields: ["Canonical Term", "Shortcode", "ctpv", "Definition"],
    };

    const records = await base(LEXICON_TABLE).select(selectOpts).all();

    const rows = records.map((r) => ({
      canonical: toStr(r.get("Canonical Term")),
      shortcode: toStr(r.get("Shortcode")),
      ctpv: toStr(r.get("ctpv")),
      definition: toStr(r.get("Definition")),
    }));

    const terms = qRaw.toLowerCase().split(/\s+/).filter(Boolean);
    const weights = {
      canonical: 5,
      shortcode: 4,
      ctpv: 3,
      definition: 1,
    };

    const scored = terms.length
      ? rows
          .map((row) => {
            const score = Object.entries(weights).reduce((total, [key, weight]) => {
              const value = row[key];
              if (!value) return total;
              const lower = value.toLowerCase();
              return (
                total +
                terms.reduce((subtotal, term) => {
                  if (!lower.includes(term)) return subtotal;
                  let fieldScore = weight;
                  if (lower === term) fieldScore += weight;
                  if (lower.startsWith(term)) fieldScore += weight * 0.5;
                  return subtotal + fieldScore;
                }, 0)
              );
            }, 0);
            return { ...row, score };
          })
          .sort((a, b) => b.score - a.score)
          .map(({ score, ...row }) => row)
      : rows;

    const result = terms.length ? scored : rows;

    return new Response(JSON.stringify({ count: result.length, lexicon: result }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Airtable error" }), {
      status: e?.statusCode || 500,
      headers: { "Access-Control-Allow-Origin": CORS },
    });
  }
}