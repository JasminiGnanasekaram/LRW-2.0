import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getDocument, downloadDocumentFile } from "../api";

const PIE_COLORS = ["#1a3a2a", "#4a7c59", "#8fb89a", "#d4e8d0", "#2d5a3d", "#6aaa80", "#b0d8b8", "#386641"];

export default function DocumentView() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState("cleaned");
  const [error, setError] = useState("");

  useEffect(() => {
    getDocument(id)
      .then(setDoc)
      .catch((e) => setError(e.response?.data?.detail || "Failed to load document."));
  }, [id]);

  if (error) return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="alert-error">{error}</div>
      <Link to="/" className="btn btn-ghost btn-sm">ÔåÉ Back to dashboard</Link>
    </div>
  );
  if (!doc) return <div className="page"><p className="muted">LoadingÔÇª</p></div>;

  const posData = Object.entries(doc.nlp?.pos_distribution || {})
    .map(([pos, count]) => ({ pos, count }))
    .sort((a, b) => b.count - a.count);
  const topWordsData = (doc.nlp?.top_words || []).slice(0, 15).map(([word, count]) => ({ word, count }));

  const TABS = [
    { key: "cleaned",  label: "Cleaned" },
    { key: "raw",      label: "Raw" },
    { key: "nlp",      label: "NLP Data" },
    { key: "charts",   label: "Charts" },
    { key: "metadata", label: "Metadata" },
  ];

  const isTamil   = doc?.nlp?.language === "Tamil";
  const isSinhala = doc?.nlp?.language === "Sinhala";

  const POS_LABELS_EN = {
    NOUN: "Noun", VERB: "Verb", ADJ: "Adjective", ADV: "Adverb",
    PROPN: "Proper Noun", DET: "Determiner", ADP: "Preposition",
    PRON: "Pronoun", CCONJ: "Conjunction", PUNCT: "Punctuation",
    NUM: "Number", AUX: "Auxiliary Verb", PART: "Particle", X: "Other",
  };
  const POS_LABELS_TA = {
    NOUN: "Ó«¬Ó»åÓ«»Ó«░Ó»ìÓ«ÜÓ»ìÓ«ÜÓ»èÓ«▓Ó»ì", VERB: "Ó«ÁÓ«┐Ó«®Ó»êÓ«ÜÓ»ìÓ«ÜÓ»èÓ«▓Ó»ì", ADJ: "Ó«¬Ó»åÓ«»Ó«░Ó«ƒÓ»ê", ADV: "Ó«ÁÓ«┐Ó«®Ó»êÓ«»Ó«ƒÓ»ê",
    PROPN: "Ó«ëÓ«»Ó«░Ó»ìÓ«¿Ó«¥Ó««Ó««Ó»ì", DET: "Ó«ñÓ»üÓ«úÓ»êÓ«¿Ó«¥Ó««Ó««Ó»ì", ADP: "Ó«çÓ«ƒÓ»êÓ«»Ó«┐Ó«»Ó«▓Ó»ì",
    PRON: "Ó««Ó»üÓ«®Ó»ìÓ«®Ó»åÓ«┤Ó»üÓ«ñÓ»ìÓ«ñÓ»ü", CCONJ: "Ó«çÓ«úÓ»êÓ«¬Ó»ìÓ«¬Ó»üÓ«ÜÓ»ì Ó«ÜÓ»èÓ«▓Ó»ì", PUNCT: "Ó«çÓ«▓Ó«òÓ»ìÓ«òÓ«úÓ««Ó»ì",
    NUM: "Ó«ÄÓ«úÓ»ì", AUX: "Ó«ëÓ«ñÓ«ÁÓ«┐ Ó«ÁÓ«┐Ó«®Ó»êÓ«ÜÓ»ìÓ«ÜÓ»èÓ«▓Ó»ì", PART: "Ó«ÄÓ«úÓ»ì", X: "Ó▓çÓ▓ñÓ▓░",
  };
  const POS_LABELS = isTamil ? POS_LABELS_TA : isSinhala ? {} : POS_LABELS_EN;

  const sentimentColor = (labelEn) => {
    if (!labelEn) return "#f0f0f0";
    const l = labelEn.toLowerCase();
    if (l === "positive") return "#d4edda";
    if (l === "negative") return "#f8d7da";
    return "#fff3cd";
  };

  // Section header style
  const sectionHead = {
    fontFamily: "var(--font-head)",
    color: "var(--forest)",
    marginBottom: 10,
    marginTop: 0,
  };

  // Section wrapper style
  const section = { marginBottom: 28 };

  // Lemmatization: pairs of (original ÔåÆ lemma) where they differ
  const lemmaPairs = (doc.nlp?.token_details || [])
    .filter(t => t.lemma && t.text !== t.lemma)
    .slice(0, 100);

  // Morphology: tokens that have feats/morph info (spaCy English)
  // For Tamil/Sinhala we show suffix-based breakdown from token details
  const morphTokens = (doc.nlp?.token_details || [])
    .filter(t => t.morph && t.morph !== "")
    .slice(0, 50);

  // Morphology feature translator
  const translateMorph = (morphStr, lang) => {
    if (!morphStr) return "";

  const MORPH_TAMIL = {
        // Case
        "Case=Nom":  "Ó«ÄÓ«┤Ó»üÓ«ÁÓ«¥Ó«»Ó»ì Ó«ÁÓ»çÓ«▒Ó»ìÓ«▒Ó»üÓ««Ó»ê",
        "Case=Acc":  "Ó«ÜÓ»åÓ«»Ó«¬Ó»ìÓ«¬Ó«ƒÓ»üÓ«¬Ó»èÓ«░Ó»üÓ«│Ó»ì Ó«ÁÓ»çÓ«▒Ó»ìÓ«▒Ó»üÓ««Ó»ê",
        "Case=Dat":  "Ó«òÓ»èÓ«ƒÓ»ê Ó«ÁÓ»çÓ«▒Ó»ìÓ«▒Ó»üÓ««Ó»ê",
        "Case=Gen":  "Ó«ëÓ«ƒÓ»êÓ««Ó»ê Ó«ÁÓ»çÓ«▒Ó»ìÓ«▒Ó»üÓ««Ó»ê",
        "Case=Loc":  "Ó«çÓ«ƒ Ó«ÁÓ»çÓ«▒Ó»ìÓ«▒Ó»üÓ««Ó»ê",
        "Case=Abl":  "Ó«¿Ó»ÇÓ«òÓ»ìÓ«ò Ó«ÁÓ»çÓ«▒Ó»ìÓ«▒Ó»üÓ««Ó»ê",
        "Case=Ins":  "Ó«òÓ«░Ó»üÓ«ÁÓ«┐ Ó«ÁÓ»çÓ«▒Ó»ìÓ«▒Ó»üÓ««Ó»ê",
        "Case=Voc":  "Ó«ÁÓ«┐Ó«│Ó«┐ Ó«ÁÓ»çÓ«▒Ó»ìÓ«▒Ó»üÓ««Ó»ê",
        // Number
        "Number=Sing": "Ó«ÆÓ«░Ó»üÓ««Ó»ê",
        "Number=Plur": "Ó«¬Ó«®Ó»ìÓ««Ó»ê",
        // Gender
        "Gender=Masc": "Ó«åÓ«úÓ»ìÓ«¬Ó«¥Ó«▓Ó»ì",
        "Gender=Fem":  "Ó«¬Ó»åÓ«úÓ»ìÓ«¬Ó«¥Ó«▓Ó»ì",
        "Gender=Neut": "Ó«¿Ó«ƒÓ»üÓ«¬Ó»ìÓ«¬Ó«¥Ó«▓Ó»ì",
        "Gender=Com":  "Ó«ëÓ«»Ó«░Ó»ìÓ«ñÓ«┐Ó«úÓ»ê",
        // Person
        "Person=1": "Ó««Ó»üÓ«®Ó»ìÓ«®Ó«┐Ó«▓Ó»ê",
        "Person=2": "Ó«¿Ó»çÓ«░Ó»ìÓ««Ó»üÓ«òÓ««Ó»ì",
        "Person=3": "Ó«¬Ó«ƒÓ«░Ó»ìÓ«òÓ»ìÓ«òÓ»ê",
        // Tense
        "Tense=Past":  "Ó«çÓ«▒Ó«¿Ó»ìÓ«ñÓ«òÓ«¥Ó«▓Ó««Ó»ì",
        "Tense=Pres":  "Ó«¿Ó«┐Ó«òÓ«┤Ó»ìÓ«òÓ«¥Ó«▓Ó««Ó»ì",
        "Tense=Fut":   "Ó«ÄÓ«ñÓ«┐Ó«░Ó»ìÓ«òÓ«¥Ó«▓Ó««Ó»ì",
        // VerbForm
        "VerbForm=Inf":    "Ó«ñÓ»èÓ«┤Ó«┐Ó«▒Ó»ìÓ«¬Ó»åÓ«»Ó«░Ó»ì",
        "VerbForm=Fin":    "Ó««Ó»üÓ«▒Ó»ìÓ«▒Ó»ü Ó«ÁÓ«┐Ó«®Ó»ê",
        "VerbForm=Part":   "Ó«¬Ó»åÓ«»Ó«░Ó»åÓ«ÜÓ»ìÓ«ÜÓ««Ó»ì",
        "VerbForm=Conv":   "Ó«ÁÓ«┐Ó«®Ó»êÓ«»Ó»åÓ«ÜÓ»ìÓ«ÜÓ««Ó»ì",
        "VerbForm=Vnoun":  "Ó«ÁÓ«┐Ó«®Ó»êÓ«»Ó»åÓ«┤Ó»üÓ«ÜÓ»ìÓ«ÜÓ«┐",
        // Voice
        "Voice=Act":  "Ó«òÓ«░Ó»ìÓ«ñÓ»ìÓ«ñÓ«░Ó«┐ Ó«ÁÓ«┐Ó«®Ó»ê",
        "Voice=Pass": "Ó«òÓ«░Ó»ìÓ««Ó«úÓ«┐ Ó«ÁÓ«┐Ó«®Ó»ê",
        // Polarity
        "Polarity=Pos": "Ó«ëÓ«ƒÓ«®Ó»ìÓ«¬Ó«¥Ó«ƒÓ»ü",
        "Polarity=Neg": "Ó«ÄÓ«ñÓ«┐Ó«░Ó»ìÓ««Ó«▒Ó»ê",
        // Animacy
        "Animacy=Anim":   "Ó«ëÓ«»Ó«┐Ó«░Ó»ìÓ«¬Ó»ìÓ«¬Ó»ü",
        "Animacy=Inanim": "Ó«ëÓ«»Ó«┐Ó«░Ó«▒Ó»ìÓ«▒",
        // NumType
        "NumType=Card": "Ó«àÓ«ƒÓ«┐Ó«¬Ó»ìÓ«¬Ó«ƒÓ»ê Ó«ÄÓ«úÓ»ì",
        "NumType=Ord":  "Ó«ÁÓ«░Ó«┐Ó«ÜÓ»ê Ó«ÄÓ«úÓ»ì",
        // Degree
        "Degree=Pos":  "Ó«ÜÓ«¥Ó«ñÓ«¥Ó«░Ó«ú Ó«¿Ó«┐Ó«▓Ó»ê",
        "Degree=Cmp":  "Ó«ÆÓ«¬Ó»ìÓ«¬Ó«┐Ó«ƒÓ»ìÓ«ƒÓ»ü Ó«¿Ó«┐Ó«▓Ó»ê",
        "Degree=Sup":  "Ó««Ó«┐Ó«òÓ»ê Ó«¿Ó«┐Ó«▓Ó»ê",
        // Mood
        "Mood=Ind":  "Ó«¿Ó»çÓ«░Ó»ì Ó«ÜÓ»èÓ«▓Ó»ì",
        "Mood=Imp":  "Ó«òÓ«ƒÓ»ìÓ«ƒÓ«│Ó»ê",
        "Mood=Sub":  "Ó«ÉÓ«»Ó«¿Ó«┐Ó«▓Ó»ê",
    };

    
  const MORPH_SINHALA = {
        // Case
        "Case=Nom":  "ÓÂÜÓÂ╗ÓÀèÓÂ¡ÓÀÿ ÓÂÜÓÀÅÓÂ╗ÓÂÜÓÂ║",
        "Case=Acc":  "ÓÂÜÓÂ╗ÓÀèÓÂ© ÓÂÜÓÀÅÓÂ╗ÓÂÜÓÂ║",
        "Case=Dat":  "ÓÀâÓÂ©ÓÀèÓÂ┤ÓÀèÔÇìÓÂ╗ÓÂ»ÓÀÅÓÂ▒ ÓÂÜÓÀÅÓÂ╗ÓÂÜÓÂ║",
        "Case=Gen":  "ÓÀéÓÀéÓÀèÓÂ¿ÓÀô ÓÂÜÓÀÅÓÂ╗ÓÂÜÓÂ║",
        "Case=Loc":  "ÓÂàÓÂ░ÓÀÆÓÂÜÓÂ╗ÓÂ½ ÓÂÜÓÀÅÓÂ╗ÓÂÜÓÂ║",
        "Case=Abl":  "ÓÂ┤ÓÂñÓÀèÓÂáÓÂ©ÓÀô ÓÂÜÓÀÅÓÂ╗ÓÂÜÓÂ║",
        "Case=Ins":  "ÓÂÜÓÂ╗ÓÂ½ ÓÂÜÓÀÅÓÂ╗ÓÂÜÓÂ║",
        "Case=Voc":  "ÓÀâÓÂ©ÓÀèÓÂÂÓÀØÓÂ░ÓÂ▒ ÓÂÜÓÀÅÓÂ╗ÓÂÜÓÂ║",
        // Number
        "Number=Sing": "ÓÂæÓÂÜÓÀÇÓÂáÓÂ▒",
        "Number=Plur": "ÓÂÂÓÀäÓÀöÓÀÇÓÂáÓÂ▒",
        // Gender
        "Gender=Masc": "ÓÂ┤ÓÀöÓÂ¢ÓÀèÓÂ¢ÓÀÆÓÂéÓÂ£",
        "Gender=Fem":  "ÓÀâÓÀèÓÂ¡ÓÀèÔÇìÓÂ╗ÓÀôÓÂ¢ÓÀÆÓÂéÓÂ£",
        "Gender=Neut": "ÓÂ▒ÓÂ┤ÓÀöÓÂéÓÀâÓÂÜÓÂ¢ÓÀÆÓÂéÓÂ£",
        "Gender=Com":  "ÓÀâÓÀÅÓÂ©ÓÀÅÓÂ▒ÓÀèÔÇìÓÂ║ ÓÂ¢ÓÀÆÓÂéÓÂ£",
        // Person
        "Person=1": "ÓÂïÓÂ¡ÓÀèÓÂ¡ÓÂ© ÓÂ┤ÓÀöÓÂ╗ÓÀöÓÀé",
        "Person=2": "ÓÂ©ÓÂ░ÓÀèÔÇìÓÂ║ÓÂ© ÓÂ┤ÓÀöÓÂ╗ÓÀöÓÀé",
        "Person=3": "ÓÂ┤ÓÀèÔÇìÓÂ╗ÓÂ«ÓÂ© ÓÂ┤ÓÀöÓÂ╗ÓÀöÓÀé",
        // Tense
        "Tense=Past":  "ÓÂàÓÂ¡ÓÀôÓÂ¡ ÓÂÜÓÀÅÓÂ¢ÓÂ║",
        "Tense=Pres":  "ÓÀÇÓÂ╗ÓÀèÓÂ¡ÓÂ©ÓÀÅÓÂ▒ ÓÂÜÓÀÅÓÂ¢ÓÂ║",
        "Tense=Fut":   "ÓÂàÓÂ▒ÓÀÅÓÂ£ÓÂ¡ ÓÂÜÓÀÅÓÂ¢ÓÂ║",
        // VerbForm
        "VerbForm=Inf":   "ÓÂàÓÂ▒ÓÂ▒ÓÀèÓÂ¡ ÓÂÜÓÀèÔÇìÓÂ╗ÓÀÆÓÂ║ÓÀÅ",
        "VerbForm=Fin":   "ÓÀâÓÀôÓÂ©ÓÀÆÓÂ¡ ÓÂÜÓÀèÔÇìÓÂ╗ÓÀÆÓÂ║ÓÀÅ",
        "VerbForm=Part":  "ÓÂÜÓÀÿÓÂ»ÓÂ▒ÓÀèÓÂ¡",
        "VerbForm=Conv":  "ÓÂ£ÓÀÖÓÂ╗ÓÀöÓÂ▒ÓÀèÓÂ®ÓÀè",
        // Voice
        "Voice=Act":  "ÓÂÜÓÂ╗ÓÀèÓÂ¡ÓÂ╗ÓÀô",
        "Voice=Pass": "ÓÂÜÓÂ╗ÓÀèÓÂ©ÓÂÜÓÀÅÓÂ╗ÓÂÜ",
        // Polarity
        "Polarity=Pos": "ÓÂ░ÓÂ▒ÓÀÅÓÂ¡ÓÀèÓÂ©ÓÂÜ",
        "Polarity=Neg": "ÓÂìÓÂ½ÓÀÅÓÂ¡ÓÀèÓÂ©ÓÂÜ",
        // Animacy
        "Animacy=Anim":   "ÓÀâÓÂóÓÀôÓÀÇÓÀô",
        "Animacy=Inanim": "ÓÂàÓÂóÓÀôÓÀÇÓÀô",
        // NumType
        "NumType=Card": "ÓÀâÓÂéÓÂøÓÀèÔÇìÓÂ║ÓÀÅÓÀÇ",
        "NumType=Ord":  "ÓÂàÓÂ▒ÓÀöÓÂÜÓÀèÔÇìÓÂ╗ÓÂ©ÓÀÆÓÂÜ",
        // Degree
        "Degree=Pos":  "ÓÀâÓÀÅÓÂ©ÓÀÅÓÂ▒ÓÀèÔÇìÓÂ║",
        "Degree=Cmp":  "ÓÀâÓÀÉÓÀâÓÂ│ÓÀôÓÂ©",
        "Degree=Sup":  "ÓÂïÓÂ┤ÓÂ╗ÓÀÆÓÂ©",
        // Mood
        "Mood=Ind":  "ÓÂ┤ÓÀèÔÇìÓÂ╗ÓÂÜÓÀÅÓÀüÓÀÅÓÂ¡ÓÀèÓÂ©ÓÂÜ",
        "Mood=Imp":  "ÓÂàÓÂ½",
        "Mood=Sub":  "ÓÀâÓÀÅÓÂ┤ÓÀÜÓÂÜÓÀèÓÀé",
    };

  const MORPH_EN = {
        "Case=Nom":  "Nominative", "Case=Acc": "Accusative",
        "Case=Dat":  "Dative", "Case=Gen": "Genitive",
        "Case=Loc":  "Locative", "Case=Abl": "Ablative",
        "Case=Ins":  "Instrumental", "Case=Voc": "Vocative",
        "Number=Sing": "Singular", "Number=Plur": "Plural",
        "Gender=Masc": "Masculine", "Gender=Fem": "Feminine",
        "Gender=Neut": "Neuter", "Gender=Com": "Common",
        "Person=1": "1st Person", "Person=2": "2nd Person", "Person=3": "3rd Person",
        "Tense=Past": "Past", "Tense=Pres": "Present", "Tense=Fut": "Future",
        "VerbForm=Inf": "Infinitive", "VerbForm=Fin": "Finite",
        "VerbForm=Part": "Participle", "VerbForm=Conv": "Converb",
        "Voice=Act": "Active", "Voice=Pass": "Passive",
        "Polarity=Pos": "Positive", "Polarity=Neg": "Negative",
        "Animacy=Anim": "Animate", "Animacy=Inanim": "Inanimate",
        "NumType=Card": "Cardinal", "NumType=Ord": "Ordinal",
        "Degree=Pos": "Positive", "Degree=Cmp": "Comparative", "Degree=Sup": "Superlative",
        "Mood=Ind": "Indicative", "Mood=Imp": "Imperative", "Mood=Sub": "Subjunctive",
    };

  const map = lang === "Tamil" ? MORPH_TAMIL :
                lang === "Sinhala" ? MORPH_SINHALA : MORPH_EN;

      return morphStr.split("|").map(feat => map[feat] || feat).join(" | ");
  };
  

  return (
    <div className="page">
      <div className="page-header fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <Link to="/" className="muted" style={{ fontSize: 13, marginBottom: 6, display: "inline-block" }}>ÔåÉ Dashboard</Link>
            <h1 className="page-title" style={{ wordBreak: "break-word" }}>{doc.filename}</h1>
            <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="badge">{doc.file_type}</span>
              <span className="muted">{new Date(doc.created_at).toLocaleDateString()}</span>
              {doc.nlp?.token_count && (
                <span className="muted">{doc.nlp.token_count.toLocaleString()} tokens</span>
              )}
              {doc.nlp?.language && (
                <span className="badge">{doc.nlp.language_display || doc.nlp.language}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              title="Download complete document data, metadata, and NLP analysis"
              onClick={() => downloadDocumentFile(id, "json")}
            >
              JSON
            </button>

            <button
              title="Download token-level NLP analysis for Excel and data analysis"
              onClick={() => downloadDocumentFile(id, "csv")}
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card fade-up fade-up-1">
        <div className="tabs">
          {TABS.map(({ key, label }) => (
            <button key={key} className={`tab-btn${tab === key ? " active" : ""}`} onClick={() => setTab(key)} type="button">
              {label}
            </button>
          ))}
        </div>

        {tab === "cleaned"  && <pre className="snippet">{doc.cleaned_text}</pre>}
        {tab === "raw"      && <pre className="snippet">{doc.raw_text}</pre>}
        {tab === "metadata" && <pre className="snippet">{JSON.stringify(doc.metadata, null, 2)}</pre>}

        {tab === "nlp" && doc.nlp && (
          <div>

            {/* ÔöÇÔöÇ 1. Language Detection ÔöÇÔöÇ */}
            <div style={section}>
              <h3 style={sectionHead}> Language Detection</h3>
              <span className="pos-chip" style={{ fontSize: 14, padding: "6px 16px", fontWeight: 600 }}>
                {doc.nlp.language_display || doc.nlp.language}
              </span>
              <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>
                {doc.nlp.token_count?.toLocaleString()} tokens ┬À{" "}
                {doc.nlp.unique_tokens?.toLocaleString()} unique ┬À{" "}
                {doc.nlp.sentence_count} sentences
              </span>
            </div>

            {/* ÔöÇÔöÇ 2. Sentiment Analysis ÔöÇÔöÇ */}
            {doc.nlp.sentiment && Object.keys(doc.nlp.sentiment).length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}> Sentiment Analysis</h3>
                <span
                  className="pos-chip"
                  style={{
                    background: sentimentColor(doc.nlp.sentiment.label_en),
                    fontSize: 15, padding: "8px 20px", fontWeight: 600,
                  }}
                >
                  {doc.nlp.sentiment.label}
                </span>
                <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>
                  {(doc.nlp.sentiment.score * 100).toFixed(1)}% confidence
                </span>
              </div>
            )}

            {/* ÔöÇÔöÇ 3. Text Classification ÔöÇÔöÇ */}
            {doc.nlp.classification && Object.keys(doc.nlp.classification).length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}> Text Classification</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(doc.nlp.classification.all || []).slice(0, 8).map((c, i) => (
                    <span
                      key={i}
                      className="pos-chip"
                      style={{
                        background: i === 0 ? "var(--mint)" : undefined,
                        fontWeight: i === 0 ? 700 : 400,
                        fontSize: 13,
                      }}
                    >
                      {c.label}: {(c.score * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ÔöÇÔöÇ 4. Named Entity Recognition (NER) ÔöÇÔöÇ */}
            {doc.nlp.entities?.length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}> Named Entity Recognition ÔÇö NER ({doc.nlp.entities.length})</h3>
                <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                  {isTamil ? "Ó«¿Ó«¬Ó«░Ó»ìÓ«òÓ«│Ó»ì, Ó«çÓ«ƒÓ«ÖÓ»ìÓ«òÓ«│Ó»ì, Ó«¿Ó«┐Ó«▒Ó»üÓ«ÁÓ«®Ó«ÖÓ»ìÓ«òÓ«│Ó»ê Ó«àÓ«ƒÓ»êÓ«»Ó«¥Ó«│Ó««Ó»ì Ó«òÓ«¥Ó«úÓ»ìÓ«òÓ«┐Ó«▒Ó«ñÓ»ü" :
                   isSinhala ? "ÓÂ┤ÓÀöÓÂ»ÓÀèÓÂ£ÓÂ¢ÓÂ║ÓÂ▒ÓÀè, ÓÀâÓÀèÓÂ«ÓÀÅÓÂ▒, ÓÀâÓÂéÓÀÇÓÀÆÓÂ░ÓÀÅÓÂ▒ ÓÀäÓÂ│ÓÀöÓÂ▒ÓÀÅ ÓÂ£ÓÂ▒ÓÀô" :
                   "Identifies people, places, and organizations in text"}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {doc.nlp.entities.slice(0, 100).map((e, i) => (
                    <span
                      key={i}
                      className="pos-chip"
                      title={`Score: ${e.score}`}
                      style={{
                        background:
                          e.label_en === "PER" || e.label === "Person" || e.label === "Ó«¿Ó«¬Ó«░Ó»ì" || e.label === "ÓÂ┤ÓÀöÓÂ»ÓÀèÓÂ£ÓÂ¢ ÓÂ▒ÓÀÅÓÂ©ÓÂ║" ? "#e8f4fd" :
                          e.label_en === "ORG" || e.label === "Organization" || e.label === "Ó«¿Ó«┐Ó«▒Ó»üÓ«ÁÓ«®Ó««Ó»ì" || e.label === "ÓÀâÓÂéÓÀÇÓÀÆÓÂ░ÓÀÅÓÂ▒ÓÂ║" ? "#fef3e2" :
                          e.label_en === "LOC" || e.label === "Location" || e.label === "Ó«çÓ«ƒÓ««Ó»ì" || e.label === "ÓÀâÓÀèÓÂ«ÓÀÅÓÂ▒ ÓÂ▒ÓÀÅÓÂ©ÓÂ║" ? "#e8fdf0" :
                          undefined,
                      }}
                    >
                      {e.text} <em>({e.label})</em>
                    </span>
                  ))}
                </div>
                {/* NER Legend */}
                <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
                  {[
                    { color: "#e8f4fd", label: isTamil ? "Ó«¿Ó«¬Ó«░Ó»ì" : isSinhala ? "ÓÂ┤ÓÀöÓÂ»ÓÀèÓÂ£ÓÂ¢" : "Person" },
                    { color: "#fef3e2", label: isTamil ? "Ó«¿Ó«┐Ó«▒Ó»üÓ«ÁÓ«®Ó««Ó»ì" : isSinhala ? "ÓÀâÓÂéÓÀÇÓÀÆÓÂ░ÓÀÅÓÂ▒" : "Organization" },
                    { color: "#e8fdf0", label: isTamil ? "Ó«çÓ«ƒÓ««Ó»ì" : isSinhala ? "ÓÀâÓÀèÓÂ«ÓÀÅÓÂ▒" : "Location" },
                  ].map((item, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 3, background: item.color, border: "1px solid #ccc", display: "inline-block" }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ÔöÇÔöÇ 5. POS Tagging ÔöÇÔöÇ */}
            <div style={section}>
              <h3 style={sectionHead}> Part-of-Speech (POS) Distribution</h3>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {isTamil ? "Ó«ÁÓ«¥Ó«░Ó»ìÓ«ñÓ»ìÓ«ñÓ»êÓ«òÓ«│Ó»ê Ó«¬Ó»åÓ«»Ó«░Ó»ìÓ«ÜÓ»ìÓ«ÜÓ»èÓ«▓Ó»ì, Ó«ÁÓ«┐Ó«®Ó»êÓ«ÜÓ»ìÓ«ÜÓ»èÓ«▓Ó»ì, Ó«¬Ó»åÓ«»Ó«░Ó«ƒÓ»ê Ó«ÄÓ«® Ó«ÁÓ«òÓ»êÓ«¬Ó»ìÓ«¬Ó«ƒÓ»üÓ«ñÓ»ìÓ«ñÓ»üÓ«òÓ«┐Ó«▒Ó«ñÓ»ü" :
                 isSinhala ? "ÓÀÇÓÂáÓÂ▒ ÓÂ▒ÓÀÅÓÂ©, ÓÂÜÓÀèÔÇìÓÂ╗ÓÀÆÓÂ║ÓÀÅ, ÓÀÇÓÀÆÓÀüÓÀÜÓÀéÓÂ½ ÓÂ¢ÓÀÖÓÀâ ÓÀÇÓÂ╗ÓÀèÓÂ£ÓÀôÓÂÜÓÂ╗ÓÂ½ÓÂ║ ÓÂÜÓÂ╗ÓÂ║ÓÀÆ" :
                 "Identifies nouns, verbs, adjectives, and other grammatical categories"}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(doc.nlp.pos_distribution || {}).map(([pos, n]) => (
                  <span key={pos} className="pos-chip">{POS_LABELS[pos] || pos}: {n}</span>
                ))}
              </div>
            </div>

            {/* ÔöÇÔöÇ 6. Tokenization ÔöÇÔöÇ */}
            <div style={section}>
              <h3 style={sectionHead}> Tokenization (first 200)</h3>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {isTamil ? "Ó«ëÓ«░Ó»êÓ«»Ó»ê Ó«ñÓ«®Ó«┐Ó«¬Ó»ìÓ«¬Ó«ƒÓ»ìÓ«ƒ Ó«ÁÓ«¥Ó«░Ó»ìÓ«ñÓ»ìÓ«ñÓ»êÓ«òÓ«│Ó«¥Ó«ò Ó«¬Ó«┐Ó«░Ó«┐Ó«òÓ»ìÓ«òÓ«┐Ó«▒Ó«ñÓ»ü" :
                 isSinhala ? "ÓÂ┤ÓÀÖÓÀà ÓÂ¡ÓÂ▒ÓÀÆ ÓÀÇÓÂáÓÂ▒ÓÀÇÓÂ¢ÓÂº ÓÂÂÓÀÖÓÂ»ÓÀÅ ÓÀÇÓÀÖÓÂ▒ÓÀè ÓÂÜÓÂ╗ÓÂ║ÓÀÆ" :
                 "Splits text into individual words with their grammatical role"}
              </p>
              <div className="snippet" style={{ maxHeight: 240 }}>
                {(doc.nlp.token_details || []).slice(0, 200).map((t, i) => (
                  <span key={i} className="pos-chip" title={t.tag ? `${t.tag} (${t.pos})` : t.pos}>
                    {t.text} <em>({POS_LABELS[t.pos] || t.pos})</em>
                  </span>
                ))}
              </div>
            </div>

            {/* ÔöÇÔöÇ 7. Lemmatization ÔöÇÔöÇ */}
            <div style={section}>
              <h3 style={sectionHead}> Lemmatization</h3>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {isTamil ? "Ó«ÁÓ«¥Ó«░Ó»ìÓ«ñÓ»ìÓ«ñÓ»êÓ«òÓ«│Ó»ê Ó«àÓ«ÁÓ«▒Ó»ìÓ«▒Ó«┐Ó«®Ó»ì Ó««Ó»éÓ«▓ Ó«ÁÓ«ƒÓ«┐Ó«ÁÓ«ñÓ»ìÓ«ñÓ«┐Ó«▒Ó»ìÓ«òÓ»ü Ó«òÓ»üÓ«▒Ó»êÓ«òÓ»ìÓ«òÓ«┐Ó«▒Ó«ñÓ»ü" :
                 isSinhala ? "ÓÀÇÓÂáÓÂ▒ ÓÂÆÓÀÇÓÀÅÓÂ║ÓÀÜ ÓÂ©ÓÀûÓÂ¢ ÓÀâÓÀèÓÀÇÓÂ╗ÓÀûÓÂ┤ÓÂ║ÓÂº ÓÂàÓÂ®ÓÀö ÓÂÜÓÂ╗ÓÂ║ÓÀÆ" :
                 "Reduces words to their base dictionary form (e.g. 'running' ÔåÆ 'run')"}
              </p>
              {lemmaPairs.length > 0 ? (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: 8,
                  maxHeight: 240,
                  overflowY: "auto",
                  background: "var(--paper)",
                  borderRadius: "var(--radius)",
                  padding: 12,
                }}>
                  {lemmaPairs.map((t, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      fontSize: 13, padding: "4px 0",
                      borderBottom: "1px solid var(--border)",
                    }}>
                      <span style={{ fontWeight: 600, color: "var(--ink)" }}>{t.text}</span>
                      <span style={{ color: "var(--ink-lt)" }}>ÔåÆ</span>
                      <span style={{ color: "var(--forest)" }}>{t.lemma}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>
                  {isTamil ? "Ó«àÓ«®Ó»êÓ«ñÓ»ìÓ«ñÓ»ü Ó«ÁÓ«¥Ó«░Ó»ìÓ«ñÓ»ìÓ«ñÓ»êÓ«òÓ«│Ó»üÓ««Ó»ì Ó«ÅÓ«▒Ó»ìÓ«òÓ«®Ó«ÁÓ»ç Ó««Ó»éÓ«▓ Ó«ÁÓ«ƒÓ«┐Ó«ÁÓ«ñÓ»ìÓ«ñÓ«┐Ó«▓Ó»ì Ó«ëÓ«│Ó»ìÓ«│Ó«®" :
                   isSinhala ? "ÓÀâÓÀÆÓÂ║ÓÂ¢ÓÀöÓÂ© ÓÀÇÓÂáÓÂ▒ ÓÂ»ÓÀÉÓÂ▒ÓÂºÓÂ©ÓÂ¡ÓÀè ÓÂ©ÓÀûÓÂ¢ ÓÀâÓÀèÓÀÇÓÂ╗ÓÀûÓÂ┤ÓÂ║ÓÀÜ ÓÂçÓÂ¡" :
                   "All words are already in their base form"}
                </p>
              )}
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                {lemmaPairs.length} word{lemmaPairs.length !== 1 ? "s" : ""} reduced to base form
              </p>
            </div>

            {/* ÔöÇÔöÇ 8. Morphological Analysis ÔöÇÔöÇ */}
            <div style={section}>
              <h3 style={sectionHead}> Morphological Analysis</h3>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {isTamil ? "Ó«ÁÓ«¥Ó«░Ó»ìÓ«ñÓ»ìÓ«ñÓ»êÓ«òÓ«│Ó«┐Ó«®Ó»ì Ó«çÓ«▓Ó«òÓ»ìÓ«òÓ«ú Ó«àÓ««Ó»êÓ«¬Ó»ìÓ«¬Ó»ê Ó«¬Ó«òÓ»üÓ«¬Ó»ìÓ«¬Ó«¥Ó«»Ó»ìÓ«ÁÓ»ü Ó«ÜÓ»åÓ«»Ó»ìÓ«òÓ«┐Ó«▒Ó«ñÓ»ü" :
                 isSinhala ? "ÓÀÇÓÂáÓÂ▒ÓÀÇÓÂ¢ ÓÀÇÓÀèÔÇìÓÂ║ÓÀÅÓÂÜÓÂ╗ÓÂ½ ÓÀÇÓÀèÔÇìÓÂ║ÓÀöÓÀäÓÂ║ ÓÀÇÓÀÆÓÀüÓÀèÓÂ¢ÓÀÜÓÀéÓÂ½ÓÂ║ ÓÂÜÓÂ╗ÓÂ║ÓÀÆ" :
                 "Analyzes grammatical structure of words (tense, number, case, gender)"}
              </p>
              {morphTokens.length > 0 ? (
                <div style={{
                  maxHeight: 240, overflowY: "auto",
                  background: "var(--paper)", borderRadius: "var(--radius)", padding: 12,
                }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "Ó«ÁÓ«¥Ó«░Ó»ìÓ«ñÓ»ìÓ«ñÓ»ê" : isSinhala ? "ÓÀÇÓÂáÓÂ▒ÓÂ║" : "Word"}
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "Ó««Ó»éÓ«▓ Ó«ÁÓ«ƒÓ«┐Ó«ÁÓ««Ó»ì" : isSinhala ? "ÓÂ©ÓÀûÓÂ¢ ÓÀâÓÀèÓÀÇÓÂ╗ÓÀûÓÂ┤ÓÂ║" : "Lemma"}
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "Ó«çÓ«▓Ó«òÓ»ìÓ«òÓ«ú Ó«ÁÓ«òÓ»ê" : isSinhala ? "ÓÀÇÓÀèÔÇìÓÂ║ÓÀÅÓÂÜÓÂ╗ÓÂ½ ÓÀÇÓÂ╗ÓÀèÓÂ£ÓÂ║" : "POS"}
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "Ó«ëÓ«░Ó»üÓ«¬Ó«┐Ó«»Ó«▓Ó»ì Ó«ñÓ«òÓ«ÁÓ«▓Ó»ì" : isSinhala ? "ÓÂ╗ÓÀûÓÂ┤ÓÀÇÓÀÆÓÂ»ÓÀèÔÇìÓÂ║ÓÀÅ ÓÂ¡ÓÀ£ÓÂ╗ÓÂ¡ÓÀöÓÂ╗ÓÀö" : "Morphology"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {morphTokens.map((t, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "4px 8px", fontWeight: 600 }}>{t.text}</td>
                          <td style={{ padding: "4px 8px", color: "var(--forest)" }}>{t.lemma}</td>
                          <td style={{ padding: "4px 8px" }}>{POS_LABELS[t.pos] || t.pos}</td>
                          <td style={{ padding: "4px 8px", color: "var(--ink-lt)", fontSize: 12 }}>{translateMorph(t.morph, doc.nlp.language)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Fallback: show POS-grouped word table for Tamil/Sinhala */
                <div style={{
                  maxHeight: 240, overflowY: "auto",
                  background: "var(--paper)", borderRadius: "var(--radius)", padding: 12,
                }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "Ó«ÁÓ«¥Ó«░Ó»ìÓ«ñÓ»ìÓ«ñÓ»ê" : isSinhala ? "ÓÀÇÓÂáÓÂ▒ÓÂ║" : "Word"}
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "Ó««Ó»éÓ«▓ Ó«ÁÓ«ƒÓ«┐Ó«ÁÓ««Ó»ì" : isSinhala ? "ÓÂ©ÓÀûÓÂ¢ ÓÀâÓÀèÓÀÇÓÂ╗ÓÀûÓÂ┤ÓÂ║" : "Lemma"}
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "Ó«çÓ«▓Ó«òÓ»ìÓ«òÓ«ú Ó«ÁÓ«òÓ»ê" : isSinhala ? "ÓÀÇÓÀèÔÇìÓÂ║ÓÀÅÓÂÜÓÂ╗ÓÂ½ ÓÀÇÓÂ╗ÓÀèÓÂ£ÓÂ║" : "POS"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(doc.nlp.token_details || []).slice(0, 50).map((t, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "4px 8px", fontWeight: 600 }}>{t.text}</td>
                          <td style={{ padding: "4px 8px", color: "var(--forest)" }}>{t.lemma}</td>
                          <td style={{ padding: "4px 8px" }}>{POS_LABELS[t.pos] || t.pos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ÔöÇÔöÇ 9. Sentences ÔöÇÔöÇ */}
            {doc.nlp.sentences?.length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}> Sentences ({doc.nlp.sentence_count})</h3>
                <div style={{
                  maxHeight: 200, overflowY: "auto",
                  background: "var(--paper)", borderRadius: "var(--radius)", padding: 12,
                }}>
                  {doc.nlp.sentences.slice(0, 20).map((s, i) => (
                    <p key={i} style={{
                      margin: "4px 0", fontSize: 13,
                      borderBottom: "1px solid var(--border)", paddingBottom: 4,
                    }}>
                      <span style={{ color: "var(--ink-lt)", marginRight: 8 }}>{i + 1}.</span>{s}
                    </p>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {tab === "charts" && doc.nlp && (
          <div>
            <h3 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 20 }}>POS Distribution</h3>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={posData} dataKey="count" nameKey="pos" cx="50%" cy="50%" outerRadius={100} label>
                    {posData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <h3 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", margin: "28px 0 20px" }}>Top Words</h3>
            <div style={{ width: "100%", height: 340 }}>
              <ResponsiveContainer>
                <BarChart data={topWordsData} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="word" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1a3a2a" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
