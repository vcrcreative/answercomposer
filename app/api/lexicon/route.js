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

    // Search only across ctpv + Canonical Term + Shortcode
    const concat = `CONCATENATE("" & {ctpv}, " ", "" & {Canonical Term}, " ", "" & {Shortcode})`;
    const filterByFormula = qRaw ? `FIND(LOWER("${esc(qRaw)}"), LOWER(${concat})) > 0` : undefined;

    // Ask Airtable to return only the three fields we need
    const selectOpts = {
      ...(filterByFormula ? { filterByFormula } : {}),
      fields: ["Canonical Term", "Shortcode", "ctpv"],
    };

    const records = await base(LEXICON_TABLE).select(selectOpts).all();

    const rows = records.map((r) => ({
      canonical: toStr(r.get("Canonical Term")),
      shortcode: toStr(r.get("Shortcode")),
      ctpv:      toStr(r.get("ctpv")),
    }));

    return new Response(JSON.stringify({ count: rows.length, lexicon: rows }), {
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