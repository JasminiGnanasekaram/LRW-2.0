import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getDocument, exportDocument } from "../api";

const PIE_COLORS = ["#1a3a2a", "#4a7c59", "#8fb89a", "#d4e8d0", "#2d5a3d", "#6aaa80", "#b0d8b8", "#386641"];
const SENTIMENT_COLORS = {
  positive: "#22c55e",
  neutral: "#eab308",
  negative: "#ef4444",
};
const LANG_COLORS = {
  English: "#3b82f6",
  Tamil: "#f97316",
  Sinhala: "#10b981",
  Other: "#8b5cf6",
};

function PdfTypeBadge({ pdfType }) {
  if (!pdfType) return null;
  const config = {
    text_only: { label: "Text Only PDF", bg: "#e8f5e9", color: "#2d6a4f", icon: "📄" },
    text_image: { label: "Text + Images PDF", bg: "#fff8e1", color: "#b45309", icon: "🖼️" },
    image_only: { label: "Scanned / Image PDF", bg: "#fce4ec", color: "#c62828", icon: "📷" },
  };
  const c = config[pdfType] || { label: pdfType, bg: "#f5f5f5", color: "#555", icon: "📄" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, background: c.bg,
      color: c.color, borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 600
    }}>
      {c.icon} {c.label}
    </span>
  );
}

// ── NLP Sections with trilingual descriptions ──────────────
const NLP_SECTIONS = [
  {
    key: "language",
    label: { English: "Language Detection", Tamil: "மொழி கண்டறிதல்", Sinhala: "භාෂා හඳුනාගැනීම" },
    icon: "🌐",
    desc: {
      English: "Detects primary and secondary languages, script proportions, and multilingual presence.",
      Tamil: "முதன்மை மற்றும் இரண்டாம் நிலை மொழிகள், எழுத்து விகிதங்கள் மற்றும் பன்மொழித் தன்மையைக் கண்டறிகிறது.",
      Sinhala: "ප්‍රාථමික හා ද්විතීයික භාෂා, අක්ෂර අනුපාත සහ බහුභාෂා පැවැත්ම හඳුනා ගනී.",
    },
  },
  {
    key: "sentiment",
    label: { English: "Sentiment Analysis", Tamil: "உணர்வு பகுப்பாய்வு", Sinhala: "හැඟීම් විශ්ලේෂණය" },
    icon: "😊",
    desc: {
      English: "Evaluates overall and sentence-by-sentence emotional polarity (Positive, Negative, or Neutral).",
      Tamil: "முழு ஆவணம் மற்றும் வாக்கிய வாரியான உணர்வு நிலையை (நேர்மறை, எதிர்மறை, நடுநிலை) மதிப்பிடுகிறது.",
      Sinhala: "සමස්ත සහ එක් එක් වාක්‍ය මට්ටමේ හැඟීම් ස්වභාවය (ධනාත්මක, සෘණාත්මක හෝ මධ්‍යස්ථ) ඇගයීමට ලක් කරයි.",
    },
  },
  {
    key: "classification",
    label: { English: "Text Classification", Tamil: "உரை வகைப்பாடு", Sinhala: "පෙළ වර්ගීකරණය" },
    icon: "🏷️",
    desc: {
      English: "Categorizes the text into domain topics (Politics, Sports, Business, Technology, Education, etc.) with probabilities.",
      Tamil: "உரையை அதன் தலைப்பு அடிப்படையில் (அரசியல், விளையாட்டு, வணிகம், தொழில்நுட்பம், கல்வி) வகைப்படுத்துகிறது.",
      Sinhala: "අන්තර්ගතය මත පදනම්ව පෙළ ක්ෂේත්‍ර කාණ්ඩවලට (දේශපාලන, ක්‍රීඩා, ව්‍යාපාරික, තාක්ෂණය, අධ්‍යාපනය ආදී) වර්ගීකරණය කරයි.",
    },
  },
  {
    key: "ner",
    label: { English: "Named Entities", Tamil: "பெயரிடப்பட்ட நிறுவனங்கள்", Sinhala: "නම් කළ ආයතන" },
    icon: "📍",
    desc: {
      English: "Extracts key named entities: Persons, Organizations, Locations, Dates, Times, and Monetary amounts.",
      Tamil: "முக்கிய பெயர்கள்: நபர்கள், நிறுவனங்கள், இடங்கள், தேதிகள், நேரம் மற்றும் பண மதிப்புகளை அடையாளம் காண்கிறது.",
      Sinhala: "වැදගත් ආයතන හඳුනා ගනී: පුද්ගලයන්, සංවිධාන, ස්ථාන, දිනයන්, වේලාව සහ මුදල් ප්‍රමාණ.",
    },
  },
  {
    key: "pos",
    label: { English: "Part-of-Speech", Tamil: "பேச்சு பகுதி", Sinhala: "කතා කොටස" },
    icon: "🔤",
    desc: {
      English: "Identifies grammatical roles of words: Nouns, Verbs, Adjectives, Adverbs, Pronouns, and Conjunctions.",
      Tamil: "வார்த்தைகளின் இலக்கண பாத்திரங்களை (பெயர்ச்சொல், வினைச்சொல், பெயரடை, வினையடை, பிரதிப்பெயர்) கண்டறிகிறது.",
      Sinhala: "වචනවල ව්‍යාකරණ භූමිකාව (නාම පද, ක්‍රියා පද, විශේෂණ, ක්‍රියා විශේෂණ, සර්වනාම) හඳුනා ගනී.",
    },
  },
  {
    key: "tokens",
    label: { English: "Tokenization", Tamil: "சொல் பிரித்தல்", Sinhala: "ටෝකනීකරණය" },
    icon: "✂️",
    desc: {
      English: "Segments the text into normalized tokens with language codes and sentence alignments.",
      Tamil: "உரையை மொழி குறியீடுகள் மற்றும் வாக்கிய வரிசையுடன் கூடிய சீராக்கப்பட்ட சொற்களாகப் பிரிக்கிறது.",
      Sinhala: "භාෂා කේත සහ වාක්‍ය පෙළගැස්ම සමඟ පෙළ ටෝකන බවට වෙන් කරයි.",
    },
  },
  {
    key: "lemma",
    label: { English: "Lemmatization", Tamil: "அடிவடிவ சுருக்கம்", Sinhala: "ලේමටීකරණය" },
    icon: "📚",
    desc: {
      English: "Reduces inflected words to their base dictionary roots across English, Tamil, and Sinhala.",
      Tamil: "வார்த்தைகளை அவற்றின் அடிப்படை அகராதி வடிவத்திற்கு மாற்றுகிறது.",
      Sinhala: "වචනවල අර්ථය වෙනස් නොකර ඒවායේ මූලික ශබ්දකෝෂ ස්වරූපයට අඩු කරයි.",
    },
  },
  {
    key: "morph",
    label: { English: "Morphological Analysis", Tamil: "உருபியல் பகுப்பாய்வு", Sinhala: "රූප විද්‍යාත්මක විශ්ලේෂණය" },
    icon: "🧬",
    desc: {
      English: "Extracts grammatical features including grammatical Case, Number, Tense, and Person.",
      Tamil: "வேற்றுமை, எண், காலம் மற்றும் நபர் போன்ற உருபியல் கூறுகளை பகுப்பாய்வு செய்கிறது.",
      Sinhala: "විභක්ති, වචන, කාලය සහ පුරුෂ වැනි රූපවිද්‍යාත්මක ලක්ෂණ විග්‍රහ කරයි.",
    },
  },
  {
    key: "sentences",
    label: { English: "Sentences", Tamil: "வாக்கியங்கள்", Sinhala: "වාක්‍ය" },
    icon: "📑",
    desc: {
      English: "Multilingual sentence segmentation handling punctuation, abbreviations, and decimal numbers.",
      Tamil: "நிறுத்தற்குறிகள், சுருக்கங்கள் மற்றும் தசம எண்களைப் பாதுகாத்து வாக்கியங்களைப் பிரிக்கிறது.",
      Sinhala: "විරාම ලකුණු, කෙටි යෙදුම් සහ දශම සංඛ්‍යා නිවැරදිව කළමනාකරණය කරමින් වාක්‍ය වෙන් කරයි.",
    },
  },
  {
    key: "statistics",
    label: { English: "Corpus Statistics", Tamil: "புள்ளிவிவரங்கள்", Sinhala: "සංඛ්‍යාලේඛන" },
    icon: "📊",
    desc: {
      English: "Detailed document metrics including character lengths, token density, vocabulary richness, and paragraph counts.",
      Tamil: "எழுத்துக்கள், சொற்கள், தனித்துவ சொற்கள் மற்றும் பத்திகள் பற்றிய முழுமையான புள்ளிவிவரங்கள்.",
      Sinhala: "අක්ෂර, ටෝකන, අනන්‍ය වචන සහ ඡේද පිළිබඳ සවිස්තරාත්මක සංඛ්‍යාලේඛන.",
    },
  },
  {
    key: "sentences",
    label: { English: "Sentences", Tamil: "வாக்கியங்கள்", Sinhala: "වාක්‍ය" },
    
    desc: {
      English: "Splits a paragraph into individual sentences for easier analysis.",
      Tamil: "எளிதான பகுப்பாய்வுக்காக ஒரு பத்தியை தனிப்பட்ட வாக்கியங்களாக பிரிக்கிறது.",
      Sinhala: "පහසු විශ්ලේෂණය සඳහා ඡේදයක් තනි වාක්‍යවලට බෙදා වෙන් කරයි.",
    },
  },
];

function SectionDesc({ desc }) {
  if (!desc) return null;
  return (
    <div style={{
      background: "var(--bg-lt)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "12px 16px",
      marginBottom: 20,
      fontSize: 13,
      color: "var(--ink-lt)",
      lineHeight: 1.6,
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
      {desc}
    </div>
  );
}

export default function DocumentView() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState("overview");
  const [nlpSec, setNlpSec] = useState("language");
  const [error, setError] = useState("");
  const [appLang, setAppLang] = useState(localStorage.getItem("lrw_lang") || "");

  useEffect(() => {
    setError("");
    getDocument(id)
      .then(setDoc)
      .catch((e) => {
        let msg = "Failed to load document.";
        const detail = e.response?.data?.detail;
        if (detail) {
          msg = typeof detail === "string" ? detail : JSON.stringify(detail);
        }
        setError(msg);
      });
  }, [id]);

  useEffect(() => {
    const handleLang = (e) => setAppLang(e.detail);
    window.addEventListener("lrw_lang_changed", handleLang);
    return () => window.removeEventListener("lrw_lang_changed", handleLang);
  }, []);

  useEffect(() => {
    if (doc?.nlp?.language && !localStorage.getItem("lrw_lang")) {
      setAppLang(doc.nlp.language);
    }
  }, [doc]);

  if (error) return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="alert-error">{error}</div>
      <Link to="/" className="btn btn-ghost btn-sm">← Back to dashboard</Link>
    </div>
  );
  if (!doc) return <div className="page"><p className="muted">Loading…</p></div>;

  const lang = appLang || doc?.nlp?.language || "English";
  const isTamil = lang === "Tamil";
  const isSinhala = lang === "Sinhala";
  const t = (obj) => (obj && (obj[lang] || obj["English"])) || "";

  // Data helpers
  const nlp = doc.nlp || {};
  const stats = nlp.statistics || {};
  const langDet = nlp.language_detection || {};
  const sentiment = nlp.sentiment || {};
  const classif = nlp.classification || {};

  // Chart datasets
  const posData = Object.entries(nlp.pos_distribution || {})
    .map(([pos, count]) => ({ pos, count }))
    .sort((a, b) => b.count - a.count);

  const topWordsData = (nlp.top_words || []).slice(0, 15)
    .map((item) => {
      if (Array.isArray(item)) return { word: item[0], count: item[1] };
      return { word: item.word || "", count: item.count || 0 };
    });

  const langChartData = (langDet.languages_detected || []).map(l => ({
    name: l.language,
    value: l.percentage,
  }));

  const sentimentChartData = Object.entries(sentiment.distribution || {}).map(([key, val]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: val,
    color: SENTIMENT_COLORS[key.toLowerCase()] || "#94a3b8",
  }));

  const classifChartData = (classif.all || []).slice(0, 6).map(c => ({
    category: c.label || c.label_en,
    score: Math.round((c.score || 0) * 100),
  }));

  const sentimentColor = (s) => {
    if (!s) return "#f0f0f0";
    const raw = (s.label_en || s.label || "").toLowerCase();
    if (raw.includes("pos") || raw.includes("நேர்மறை") || raw.includes("ධනාත්මක")) return "#dcfce7";
    if (raw.includes("neg") || raw.includes("எதிர்மறை") || raw.includes("සෘණාත්මක")) return "#fee2e2";
    return "#fef9c3";
  };

  const lemmaPairs = (nlp.token_details || []).filter(tok => tok.lemma && tok.text !== tok.lemma).slice(0, 100);
  const morphTokens = (nlp.token_details || []).filter(tok => tok.morph && tok.morph !== "").slice(0, 50);

  const translateMorph = (morphStr) => {
    if (!morphStr) return "";
    const MORPH_EN = {
      "Case=Nom": "Nominative", "Case=Acc": "Accusative", "Case=Dat": "Dative", "Case=Gen": "Genitive",
      "Case=Abl": "Ablative", "Case=Loc": "Locative", "Case=Ins": "Instrumental", "Case=Com": "Comitative",
      "Number=Sing": "Singular", "Number=Plur": "Plural", "Gender=Masc": "Masculine", "Gender=Fem": "Feminine",
      "Gender=Neut": "Neuter", "Tense=Past": "Past", "Tense=Pres": "Present", "Tense=Fut": "Future",
      "VerbForm=Inf": "Infinitive", "VerbForm=Fin": "Finite", "VerbForm=Part": "Participle",
      "Voice=Act": "Active", "Voice=Pass": "Passive", "Aspect=Perf": "Perfect", "Aspect=Prog": "Progressive",
    };
    const MORPH_TAMIL = {
      "Case=Nom": "எழுவாய்", "Case=Acc": "இரண்டாம் வேற்றுமை (ஐ)", "Case=Dat": "நான்காம் வேற்றுமை (கு)",
      "Case=Gen": "ஆறாம் வேற்றுமை (இன்)", "Case=Abl": "ஐந்தாம் வேற்றுமை (இலிருந்து)", "Case=Loc": "ஏழாம் வேற்றுமை (இல்)",
      "Case=Ins": "மூன்றாம் வேற்றுமை (ஆல்)", "Case=Com": "உடன் வேற்றுமை", "Number=Sing": "ஒருமை", "Number=Plur": "பன்மை",
      "Tense=Past": "இறந்தகாலம்", "Tense=Pres": "நிகழ்காலம்", "Tense=Fut": "எதிர்காலம்",
      "VerbForm=Inf": "தொழிற்பெயர்", "VerbForm=Fin": "முற்று வினை", "VerbForm=Part": "பெயரெச்சம்/வினையெச்சம்",
      "Voice=Act": "செய்வினை", "Voice=Pass": "செயப்பாட்டுவினை",
    };
    const MORPH_SINHALA = {
      "Case=Nom": "ප්‍රථමා විභක්තිය", "Case=Acc": "කර්ම විභක්තිය", "Case=Dat": "සම්ප්‍රදාන විභක්තිය",
      "Case=Gen": "සම්බන්ධ විභක්තිය", "Case=Abl": "අවධි විභක්තිය", "Case=Loc": "ආධාර විභක්තිය",
      "Case=Ins": "කරණ විභක්තිය", "Number=Sing": "ඒකවචන", "Number=Plur": "බහුවචන",
      "Tense=Past": "අතීත කාලය", "Tense=Pres": "වර්තමාන කාලය", "Tense=Fut": "අනාගත කාලය",
      "VerbForm=Inf": "අනියම් ක්‍රියාව", "VerbForm=Fin": "සීමිත ක්‍රියාව", "VerbForm=Part": "කෘදන්තය",
      "Voice=Act": "කර්තෘ කාරක", "Voice=Pass": "කර්ම කාරක",
    };
    const map = lang === "Tamil" ? MORPH_TAMIL : lang === "Sinhala" ? MORPH_SINHALA : MORPH_EN;
    return morphStr.split("|").map(f => map[f] || f).join(" | ");
  };

  const TABS = [
    { key: "overview", label: isTamil ? "கண்ணோட்டம்" : isSinhala ? "දළ විශ්ලේෂණය" : "Overview" },
    { key: "cleaned", label: isTamil ? "சுத்திகரிக்கப்பட்ட உரை" : isSinhala ? "පිරිසිදු කළ පෙළ" : "Cleaned Text" },
    { key: "raw", label: isTamil ? "அசல் உரை" : isSinhala ? "මුල් පෙළ" : "Raw Text" },
    ...(doc.nlp ? [
      { key: "nlp", label: isTamil ? "NLP தரவு" : isSinhala ? "NLP දත්ත" : "NLP Data" },
      { key: "charts", label: isTamil ? "வரைபடங்கள்" : isSinhala ? "ප්‍රස්ථාර" : "Charts" },
    ] : []),
    { key: "metadata", label: isTamil ? "மெட்டாடேட்டா" : isSinhala ? "පාරදත්ත" : "Metadata" },
  ];

  const scrollBox = {
    maxHeight: 300, overflowY: "auto",
    border: "1px solid var(--border)",
    borderRadius: 8, background: "var(--paper)",
  };
  const th = {
    textAlign: "left", padding: "9px 12px",
    fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", color: "var(--ink-lt)",
    background: "var(--bg-lt)", borderBottom: "2px solid var(--border)",
  };
  const tdStyle = (z) => ({
    padding: "8px 12px", borderBottom: "1px solid var(--border)",
    background: z ? "var(--bg-lt)" : "transparent",
  });

  const currentSection = NLP_SECTIONS.find(s => s.key === nlpSec);

  const renderNlpSection = () => {
    if (!doc.nlp) return null;

    switch (nlpSec) {
      case "language":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{
                background: "var(--mint)", color: "var(--forest)",
                borderRadius: 8, padding: "10px 20px", fontSize: 16, fontWeight: 700
              }}>
                {nlp.language_display || nlp.language}
              </span>
              {langDet.is_multilingual && (
                <span className="badge" style={{ background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>
                  🌐 {isTamil ? "பன்மொழி ஆவணம்" : isSinhala ? "බහුභාෂා ලේඛනය" : "Multilingual Document"}
                </span>
              )}
            </div>

            {/* Language Progress Bar */}
            {langDet.languages_detected?.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, color: "var(--ink-lt)", marginBottom: 8, fontWeight: 600 }}>
                  {isTamil ? "மொழி விகிதங்கள்" : isSinhala ? "භාෂා අනුපාතය" : "Language Distribution"}
                </div>
                <div style={{ height: 12, display: "flex", borderRadius: 99, overflow: "hidden", background: "#e2e8f0" }}>
                  {langDet.languages_detected.map((l, i) => (
                    <div
                      key={i}
                      title={`${l.language}: ${l.percentage}%`}
                      style={{
                        width: `${l.percentage}%`,
                        background: LANG_COLORS[l.language] || PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                  {langDet.languages_detected.map((l, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: LANG_COLORS[l.language] || PIE_COLORS[i % PIE_COLORS.length]
                      }} />
                      <strong>{l.language}</strong> ({l.percentage}%)
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
              {[
                { val: nlp.token_count?.toLocaleString(), label: isTamil ? "சொற்கள்" : isSinhala ? "ටෝකන්" : "Tokens" },
                { val: nlp.unique_tokens?.toLocaleString(), label: isTamil ? "தனித்துவமானவை" : isSinhala ? "අනන්‍ය" : "Unique" },
                { val: nlp.sentence_count, label: isTamil ? "வாக்கியங்கள்" : isSinhala ? "වාක්‍ය" : "Sentences" },
                { val: stats.characters?.toLocaleString(), label: isTamil ? "எழுத்துக்கள்" : isSinhala ? "අක්ෂර" : "Characters" },
              ].map(({ val, label }) => (
                <div key={label} style={{
                  textAlign: "center", background: "var(--bg-lt)",
                  borderRadius: 10, padding: "14px 16px"
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "var(--forest)" }}>{val ?? "—"}</div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-lt)", marginTop: 4 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "sentiment":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
              <span style={{
                background: sentimentColor(sentiment),
                borderRadius: 8, padding: "12px 24px", fontSize: 18, fontWeight: 700, color: "var(--ink)"
              }}>
                {sentiment.label || "Neutral"}
              </span>
              <div>
                <div style={{ fontSize: 12, color: "var(--ink-lt)", marginBottom: 4 }}>
                  {isTamil ? "நம்பிக்கை அளவு" : isSinhala ? "විශ්වාසනීයත්වය" : "Confidence"}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 140, height: 8, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                      width: `${((sentiment.confidence || sentiment.score || 0.5) * 100).toFixed(0)}%`,
                      height: "100%", background: "var(--forest)", borderRadius: 99
                    }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--forest)" }}>
                    {((sentiment.confidence || sentiment.score || 0.5) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Sentence-level sentiment list */}
            {sentiment.sentences?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: "var(--ink)" }}>
                  📑 {isTamil ? "வாக்கிய வாரியான உணர்வு" : isSinhala ? "වාක්‍ය මට්ටමේ හැඟීම්" : "Sentence-by-Sentence Sentiment"}
                </div>
                <div style={scrollBox}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th style={{ ...th, width: 35 }}>#</th>
                        <th style={th}>{isTamil ? "வாக்கியம்" : isSinhala ? "වාක්‍යය" : "Sentence"}</th>
                        <th style={{ ...th, width: 90 }}>{isTamil ? "மொழி" : isSinhala ? "භාෂාව" : "Lang"}</th>
                        <th style={{ ...th, width: 100 }}>{isTamil ? "உணர்வு" : isSinhala ? "හැඟීම" : "Sentiment"}</th>
                        <th style={{ ...th, width: 80 }}>{isTamil ? "மதிப்பெண்" : isSinhala ? "ලකුණ" : "Score"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentiment.sentences.map((s, i) => (
                        <tr key={i}>
                          <td style={{ ...tdStyle(i % 2), color: "var(--ink-lt)" }}>{i + 1}</td>
                          <td style={tdStyle(i % 2)}>{s.sentence}</td>
                          <td style={tdStyle(i % 2)}><span className="badge" style={{ fontSize: 11 }}>{s.language}</span></td>
                          <td style={tdStyle(i % 2)}>
                            <span style={{
                              display: "inline-block", padding: "2px 8px", borderRadius: 4,
                              background: s.sentiment === "Positive" ? "#dcfce7" : s.sentiment === "Negative" ? "#fee2e2" : "#fef9c3",
                              fontSize: 12, fontWeight: 600
                            }}>
                              {s.sentiment}
                            </span>
                          </td>
                          <td style={{ ...tdStyle(i % 2), fontWeight: 600 }}>{(s.confidence * 100).toFixed(0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      case "classification":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "var(--ink-lt)", marginBottom: 4 }}>
                {isTamil ? "கணிக்கப்பட்ட முதன்மை வகை" : isSinhala ? "පුරෝකථනය කළ ප්‍රධාන ක්ෂේත්‍රය" : "Top Predicted Category"}
              </div>
              <span style={{
                display: "inline-block", background: "var(--mint)", border: "1.5px solid var(--forest)",
                borderRadius: 8, padding: "8px 18px", fontSize: 16, fontWeight: 700, color: "var(--forest)"
              }}>
                🏷️ {classif.predicted_label || classif.predicted_category || "General"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 }}>
              {(classif.all || []).map((c, i) => (
                <div key={i} style={{ background: "var(--bg-lt)", borderRadius: 6, padding: "8px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: i === 0 ? 700 : 500 }}>{c.label || c.label_en}</span>
                    <span style={{ fontWeight: 600, color: "var(--forest)" }}>{((c.score || 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 6, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                      width: `${((c.score || 0) * 100).toFixed(1)}%`,
                      height: "100%", background: i === 0 ? "var(--forest)" : "#94a3b8",
                      borderRadius: 99
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "ner":
        if (!nlp.entities?.length)
          return <><SectionDesc desc={t(currentSection?.desc)} /><p className="muted">{isTamil ? "நிறுவனங்கள் இல்லை" : isSinhala ? "ආයතන හමු නොවීය" : "No entities detected."}</p></>;
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {nlp.entities.slice(0, 100).map((e, i) => {
                const bg =
                  (e.label_en === "PER") ? "#eff6ff" :
                    (e.label_en === "ORG") ? "#fff7ed" :
                      (e.label_en === "LOC") ? "#f0fdf4" :
                        (e.label_en === "DATE" || e.label_en === "TIME") ? "#fefce8" :
                          (e.label_en === "MONEY") ? "#fdf4ff" : "#f4f4f4";
                const dot =
                  (e.label_en === "PER") ? "#3b82f6" :
                    (e.label_en === "ORG") ? "#f97316" :
                      (e.label_en === "LOC") ? "#22c55e" :
                        (e.label_en === "DATE" || e.label_en === "TIME") ? "#eab308" :
                          (e.label_en === "MONEY") ? "#a855f7" : "#a8a29e";
                return (
                  <span key={i} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 999,
                    background: bg, fontSize: 13, fontWeight: 500,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot }} />
                    <span>{e.text}</span>
                    <em style={{ fontSize: 11, opacity: 0.65, fontStyle: "normal" }}>({e.label})</em>
                  </span>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
              {[
                { dot: "#3b82f6", en: "Person", ta: "நபர்", si: "පුද්ගල" },
                { dot: "#f97316", en: "Organization", ta: "நிறுவனம்", si: "සංවිධාන" },
                { dot: "#22c55e", en: "Location", ta: "இடம்", si: "ස්ථාන" },
                { dot: "#eab308", en: "Date / Time", ta: "தேதி / நேரம்", si: "දිනය / වේලාව" },
                { dot: "#a855f7", en: "Money", ta: "பணம்", si: "මුදල්" },
                { dot: "#a8a29e", en: "Other", ta: "மற்றவை", si: "වෙනත්" },
              ].map(({ dot, en, ta, si }) => (
                <span key={en} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-lt)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot }} />
                  {isTamil ? ta : isSinhala ? si : en}
                </span>
              ))}
            </div>
          </div>
        );

      case "pos":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(nlp.pos_distribution || {}).map(([pos, n]) => (
                <span key={pos} className="pos-chip" style={{ border: "1px solid var(--border)", padding: "6px 12px" }}>
                  <strong>{pos}</strong>
                  <span style={{ color: "var(--ink-lt)", marginLeft: 6, fontWeight: 700 }}>{n}</span>
                </span>
              ))}
            </div>
          </div>
        );

      case "tokens":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={scrollBox}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ ...th, width: 35 }}>#</th>
                    <th style={th}>{isTamil ? "சொல்" : isSinhala ? "ටෝකනය" : "Token"}</th>
                    <th style={th}>{isTamil ? "அடிவடிவம்" : isSinhala ? "මූලය" : "Lemma"}</th>
                    <th style={{ ...th, width: 70 }}>POS</th>
                    <th style={{ ...th, width: 60 }}>{isTamil ? "மொழி" : isSinhala ? "භාෂාව" : "Lang"}</th>
                    <th style={{ ...th, width: 80 }}>{isTamil ? "வாக்கிய எண்" : isSinhala ? "වාක්‍ය අංකය" : "Sent ID"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(nlp.token_details || []).slice(0, 250).map((tk, i) => (
                    <tr key={i}>
                      <td style={{ ...tdStyle(i % 2), color: "var(--ink-lt)" }}>{i + 1}</td>
                      <td style={{ ...tdStyle(i % 2), fontWeight: 600 }}>{tk.token || tk.text}</td>
                      <td style={{ ...tdStyle(i % 2), color: "var(--forest)" }}>{tk.lemma}</td>
                      <td style={tdStyle(i % 2)}><span className="pos-chip" style={{ fontSize: 11, padding: "1px 6px" }}>{tk.pos}</span></td>
                      <td style={tdStyle(i % 2)}><span className="badge" style={{ fontSize: 11 }}>{tk.language || "en"}</span></td>
                      <td style={{ ...tdStyle(i % 2), color: "var(--ink-lt)" }}>{tk.sentence_id || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "lemma":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            {lemmaPairs.length > 0 ? (
              <div style={scrollBox}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={th}>{isTamil ? "அசல் சொல்" : isSinhala ? "මුල් වචනය" : "Original"}</th>
                      <th style={{ ...th, width: 32 }}></th>
                      <th style={th}>{isTamil ? "அடிவடிவம்" : isSinhala ? "මූල ස්වරූපය" : "Base Form (Lemma)"}</th>
                      <th style={{ ...th, width: 80 }}>{isTamil ? "மொழி" : isSinhala ? "භාෂාව" : "Language"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lemmaPairs.map((tk, i) => (
                      <tr key={i}>
                        <td style={tdStyle(i % 2)}><strong>{tk.text || tk.token}</strong></td>
                        <td style={{ ...tdStyle(i % 2), color: "var(--ink-lt)" }}>→</td>
                        <td style={{ ...tdStyle(i % 2), color: "var(--forest)", fontWeight: 600 }}>{tk.lemma}</td>
                        <td style={tdStyle(i % 2)}><span className="badge" style={{ fontSize: 11 }}>{tk.language || "en"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                {isTamil ? "அனைத்து வார்த்தைகளும் ஏற்கனவே அவற்றின் அடிவடிவத்தில் உள்ளன." :
                  isSinhala ? "සියලු වචන දැනටමත් මූල ස්වරූපයේ ඇත." :
                    "All words are already in base form."}
              </p>
            )}
          </div>
        );

      case "morph":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={scrollBox}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={th}>{isTamil ? "வார்த்தை" : isSinhala ? "වචනය" : "Word"}</th>
                    <th style={th}>{isTamil ? "அடிவடிவம்" : isSinhala ? "මූලය" : "Lemma"}</th>
                    <th style={{ ...th, width: 80 }}>POS</th>
                    <th style={th}>{isTamil ? "இலக்கண உருபியல் கூறுகள்" : isSinhala ? "රූපවිද්‍යාත්මක ලක්ෂණ" : "Morphological Features"}</th>
                  </tr>
                </thead>
                <tbody>
                  {(morphTokens.length > 0 ? morphTokens : (nlp.token_details || []).slice(0, 50)).map((tk, i) => (
                    <tr key={i}>
                      <td style={{ ...tdStyle(i % 2), fontWeight: 600 }}>{tk.text || tk.token}</td>
                      <td style={{ ...tdStyle(i % 2), color: "var(--forest)" }}>{tk.lemma}</td>
                      <td style={tdStyle(i % 2)}>
                        <span className="pos-chip" style={{ fontSize: 11, padding: "2px 8px" }}>
                          {tk.pos}
                        </span>
                      </td>
                      <td style={{ ...tdStyle(i % 2), color: "var(--ink)", fontSize: 12 }}>
                        {tk.morph ? translateMorph(tk.morph) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "sentences":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={scrollBox}>
              {(nlp.sentences || []).map((s, i) => (
                <div key={i} style={{
                  padding: "10px 14px", borderBottom: "1px solid var(--border)",
                  fontSize: 13, lineHeight: 1.6, display: "flex", gap: 12,
                  background: i % 2 ? "var(--bg-lt)" : "transparent"
                }}>
                  <span style={{ color: "var(--ink-lt)", minWidth: 24, flexShrink: 0, fontWeight: 600 }}>{i + 1}.</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "statistics":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
              {[
                { label: isTamil ? "மொத்த எழுத்துக்கள்" : isSinhala ? "මුළු අක්ෂර" : "Total Characters", val: stats.characters?.toLocaleString() },
                { label: isTamil ? "இடைவெளியற்ற எழுத்துக்கள்" : isSinhala ? "හිස්තැන් රහිත අක්ෂර" : "Characters (No Space)", val: stats.characters_without_spaces?.toLocaleString() },
                { label: isTamil ? "மொத்த சொற்கள்" : isSinhala ? "මුළු ටෝකන" : "Total Tokens", val: stats.tokens?.toLocaleString() },
                { label: isTamil ? "தனித்துவ சொற்கள்" : isSinhala ? "අනන්‍ය වචන" : "Unique Tokens", val: stats.unique_tokens?.toLocaleString() },
                { label: isTamil ? "வாக்கியங்கள்" : isSinhala ? "වාක්‍ය ගණන" : "Sentence Count", val: stats.sentences?.toLocaleString() },
                { label: isTamil ? "பத்திகள்" : isSinhala ? "ඡේද ගණන" : "Paragraph Count", val: stats.paragraphs?.toLocaleString() },
              ].map(({ label, val }) => (
                <div key={label} style={{
                  background: "var(--bg-lt)", borderRadius: 8, padding: "14px 18px", border: "1px solid var(--border)"
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--forest)" }}>{val ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-lt)", marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="page">
      <div className="page-header fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link to="/" className="muted" style={{ fontSize: 13, marginBottom: 6, display: "inline-block" }}>
              ← {isTamil ? "முகப்பு" : isSinhala ? "පුවරුව" : "Dashboard"}
            </Link>
            <h1 className="page-title" style={{ wordBreak: "break-word" }}>{doc.filename}</h1>
            <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="badge">{doc.file_type}</span>
              {doc.file_type === "pdf" && <PdfTypeBadge pdfType={doc.pdf_type} />}
              {nlp.language && (
                <span className="badge" style={{ background: "var(--mint)", color: "var(--forest)", fontWeight: 600 }}>
                  {nlp.language_display || nlp.language}
                </span>
              )}
              <span className="muted">{new Date(doc.created_at).toLocaleDateString()}</span>
              {nlp.token_count != null && <span className="muted">{nlp.token_count.toLocaleString()} tokens</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: "auto", alignSelf: "flex-start" }}>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              title="Download JSON format"
              onClick={() => exportDocument(id, "json", doc.filename?.split(".")[0] || "document")}
            >
              📥 JSON
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              title="Download CSV format"
              onClick={() => exportDocument(id, "csv", doc.filename?.split(".")[0] || "document")}
            >
              📥 CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card fade-up fade-up-1">
        <div className="tabs">
          {TABS.map(({ key, label }) => (
            <button key={key} className={`tab-btn${tab === key ? " active" : ""}`}
              onClick={() => setTab(key)} type="button">{label}</button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (
          <div style={{ padding: "8px 0" }}>
            <div style={{
              background: "var(--mint)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "16px 20px", marginBottom: 20
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: "var(--forest)",
                textTransform: "uppercase", letterSpacing: 1, marginBottom: 8
              }}>
                📋 {isTamil ? "ஆவண சுருக்கம்" : isSinhala ? "ලේඛන සාරාංශය" : "Document Summary"}
              </div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--ink)" }}>
                {doc.summary || "No summary available."}
              </p>
            </div>

            {/* Stats Overview */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12, marginBottom: 20
            }}>
              {[
                { label: isTamil ? "வகை" : isSinhala ? "වර්ගය" : "File Type", value: doc.file_type?.toUpperCase() || "—" },
                { label: isTamil ? "மொழி" : isSinhala ? "භාෂාව" : "Primary Language", value: nlp.language || "—" },
                { label: isTamil ? "சொற்கள்" : isSinhala ? "ටෝකන" : "Tokens", value: nlp.token_count?.toLocaleString() || "—" },
                { label: isTamil ? "தனித்துவ சொற்கள்" : isSinhala ? "අනන්‍ය" : "Unique Tokens", value: nlp.unique_tokens?.toLocaleString() || "—" },
                { label: isTamil ? "வாக்கியங்கள்" : isSinhala ? "වාක්‍ය" : "Sentences", value: nlp.sentence_count?.toLocaleString() || "—" },
                { label: isTamil ? "பதிவேற்றம்" : isSinhala ? "උඩුගත කළ දිනය" : "Uploaded", value: new Date(doc.created_at).toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  background: "var(--bg-lt)", borderRadius: 8,
                  padding: "12px 14px", textAlign: "center"
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--forest)" }}>{value}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-lt)", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Keywords */}
            {nlp.top_keywords?.length > 0 && (
              <div>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: "var(--forest)",
                  textTransform: "uppercase", letterSpacing: 1, marginBottom: 10
                }}>
                  🔑 {isTamil ? "முக்கிய குறிச்சொற்கள்" : isSinhala ? "ප්‍රධාන මූල පද" : "Top Keywords"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {nlp.top_keywords.map((kw, i) => (
                    <span key={i} style={{
                      background: "var(--forest)", color: "#fff",
                      borderRadius: 20, padding: "4px 14px", fontSize: 13
                    }}>{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "cleaned" && <pre className="snippet">{doc.cleaned_text}</pre>}
        {tab === "raw" && <pre className="snippet">{doc.raw_text}</pre>}
        {tab === "metadata" && <pre className="snippet">{JSON.stringify(doc.metadata, null, 2)}</pre>}

        {/* NLP Tab with sidebar */}
        {tab === "nlp" && doc.nlp && (
          <div style={{ display: "flex", minHeight: 520 }}>
            {/* Sidebar */}
            <div style={{
              width: 220, flexShrink: 0,
              borderRight: "1px solid var(--border)",
              background: "var(--bg-lt)",
              padding: "12px 0",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                textTransform: "uppercase", color: "var(--ink-lt)",
                padding: "4px 18px 10px"
              }}>
                {isTamil ? "NLP பகுப்பாய்வு" : isSinhala ? "NLP විශ්ලේෂණය" : "NLP Analysis"}
              </div>
              {NLP_SECTIONS.map(({ key, label, icon }) => (
                <button key={key} type="button" onClick={() => setNlpSec(key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "10px 18px",
                    background: nlpSec === key ? "var(--card,#fff)" : "transparent",
                    border: "none",
                    borderLeft: nlpSec === key ? "3px solid var(--forest)" : "3px solid transparent",
                    color: nlpSec === key ? "var(--forest)" : "var(--ink-lt)",
                    fontWeight: nlpSec === key ? 600 : 400,
                    fontSize: 13, cursor: "pointer", textAlign: "left",
                  }}>
                  <span>{icon}</span>
                  <span>{t(label)}</span>
                </button>
              ))}
            </div>

            {/* Content Panel */}
            <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto", minWidth: 0 }}>
              <h2 style={{
                margin: "0 0 16px 0", fontSize: 18, fontWeight: 700, color: "var(--ink)",
                display: "flex", alignItems: "center", gap: 8
              }}>
                <span>{currentSection?.icon}</span> {t(currentSection?.label)}
              </h2>
              {renderNlpSection()}
            </div>
          </div>
        )}

        {/* Charts Tab */}
        {tab === "charts" && doc.nlp && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: "10px 0" }}>
            
            {/* Chart 1: Language Distribution */}
            <div style={{ background: "var(--bg-lt)", borderRadius: 10, padding: 18, border: "1px solid var(--border)" }}>
              <h4 style={{ color: "var(--forest)", margin: "0 0 14px 0" }}>
                🌐 {isTamil ? "மொழிப் பகிர்வு" : isSinhala ? "භාෂා බෙදාහැරීම" : "Language Breakdown"}
              </h4>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={langChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => `${entry.name} (${entry.value}%)`}>
                      {langChartData.map((entry, i) => (
                        <Cell key={i} fill={LANG_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Sentiment Distribution */}
            <div style={{ background: "var(--bg-lt)", borderRadius: 10, padding: 18, border: "1px solid var(--border)" }}>
              <h4 style={{ color: "var(--forest)", margin: "0 0 14px 0" }}>
                😊 {isTamil ? "உணர்வு விகிதங்கள்" : isSinhala ? "හැඟීම් අනුපාතය" : "Sentiment Distribution"}
              </h4>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={sentimentChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={(entry) => `${entry.name} (${entry.value}%)`}>
                      {sentimentChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: POS Distribution */}
            <div style={{ background: "var(--bg-lt)", borderRadius: 10, padding: 18, border: "1px solid var(--border)" }}>
              <h4 style={{ color: "var(--forest)", margin: "0 0 14px 0" }}>
                🔤 {isTamil ? "இலக்கண வகை (POS)" : isSinhala ? "කතා කොටස් (POS)" : "Part-of-Speech Distribution"}
              </h4>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={posData.slice(0, 8)}>
                    <XAxis dataKey="pos" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--forest)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Classification Probabilities */}
            <div style={{ background: "var(--bg-lt)", borderRadius: 10, padding: 18, border: "1px solid var(--border)" }}>
              <h4 style={{ color: "var(--forest)", margin: "0 0 14px 0" }}>
                🏷️ {isTamil ? "உரை வகைப்பாடு நிகழ்தகவு" : isSinhala ? "වර්ගීකරණ සම්භාවිතාව" : "Classification Probabilities (%)"}
              </h4>
              <div style={{ width: "100%", height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={classifChartData} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="score" fill="#4a7c59" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}