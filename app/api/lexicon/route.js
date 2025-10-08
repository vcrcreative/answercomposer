import Airtable from "airtable";

const { AIRTABLE_ACCESS_TOKEN, AIRTABLE_BASE_ID, LEXICON_TABLE } = process.env;
const CORS = process.env.CORS_ALLOW_ORIGIN || "*";
const base = new Airtable({ apiKey: AIRTABLE_ACCESS_TOKEN }).base(AIRTABLE_BASE_ID);

// stringify helper (handles arrays and {value,state} cells)
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
    const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"'); // escape \ and "

    // Build a case-insensitive search across ctpv + Canonical Term + Shortcode + Definition.
    // Using FIND(LOWER(...), LOWER(...)) > 0 tends to be most reliable.
    const concat =
      `CONCATENATE("" & {ctpv}, " ", "" & {Canonical Term}, " ", "" & {Shortcode}, " ", "" & {Definition})`;
    const formula = qRaw
      ? `FIND(LOWER("${esc(qRaw)}"), LOWER(${concat})) > 0`
      : ""; // no filter => return all

    // Fetch ALL matching records (no 100-row cap)
    const records = await base(LEXICON_TABLE)
      .select({
        ...(formula ? { filterByFormula: formula } : {}),
      })
      .all();

    const rows = records.map((r) => ({
      canonical:  toStr(r.get("Canonical Term")),
      shortcode:  toStr(r.get("Shortcode")),
      definition: toStr(r.get("Definition")),
      ctpv:       toStr(r.get("ctpv")),  // ← always included
    }));

    return new Response(JSON.stringify({ count: rows.length, lexicon: rows }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": CORS },
    });
  } catch (e) {
    console.error("LEXICON ROUTE ERROR:", { msg: e?.message, statusCode: e?.statusCode, table: LEXICON_TABLE });
    return new Response(JSON.stringify({ error: e?.message || "Airtable error" }), {
      status: e?.statusCode || 500,
      headers: { "Access-Control-Allow-Origin": CORS },
    });
  }
}