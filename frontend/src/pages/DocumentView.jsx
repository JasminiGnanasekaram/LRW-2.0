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
      <Link to="/" className="btn btn-ghost btn-sm">← Back to dashboard</Link>
    </div>
  );
  if (!doc) return <div className="page"><p className="muted">Loading…</p></div>;

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
    NOUN: "பெயர்ச்சொல்", VERB: "வினைச்சொல்", ADJ: "பெயரடை", ADV: "வினையடை",
    PROPN: "உயர்நாமம்", DET: "துணைநாமம்", ADP: "இடையியல்",
    PRON: "முன்னெழுத்து", CCONJ: "இணைப்புச் சொல்", PUNCT: "இலக்கணம்",
    NUM: "எண்", AUX: "உதவி வினைச்சொல்", PART: "எண்", X: "ಇತರ",
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

  // Lemmatization: pairs of (original → lemma) where they differ
  const lemmaPairs = (doc.nlp?.token_details || [])
    .filter(t => t.lemma && t.text !== t.lemma)
    .slice(0, 100);

  // Morphology: tokens that have feats/morph info (spaCy English)
  const morphTokens = (doc.nlp?.token_details || [])
    .filter(t => t.morph && t.morph !== "")
    .slice(0, 50);

  // Morphology feature translator
  const translateMorph = (morphStr, lang) => {
    if (!morphStr) return "";

    const MORPH_TAMIL = {
      // Case
      "Case=Nom":  "எழுவாய் வேற்றுமை",
      "Case=Acc":  "செயப்படுபொருள் வேற்றுமை",
      "Case=Dat":  "கொடை வேற்றுமை",
      "Case=Gen":  "உடைமை வேற்றுமை",
      "Case=Loc":  "இட வேற்றுமை",
      "Case=Abl":  "நீக்க வேற்றுமை",
      "Case=Ins":  "கருவி வேற்றுமை",
      "Case=Voc":  "விளி வேற்றுமை",
      // Number
      "Number=Sing": "ஒருமை",
      "Number=Plur": "பன்மை",
      // Gender
      "Gender=Masc": "ஆண்பால்",
      "Gender=Fem":  "பெண்பால்",
      "Gender=Neut": "நடுப்பால்",
      "Gender=Com":  "உயர்திணை",
      // Person
      "Person=1": "முன்னிலை",
      "Person=2": "நேர்முகம்",
      "Person=3": "படர்க்கை",
      // Tense
      "Tense=Past":  "இறந்தகாலம்",
      "Tense=Pres":  "நிகழ்காலம்",
      "Tense=Fut":   "எதிர்காலம்",
      // VerbForm
      "VerbForm=Inf":   "தொழிற்பெயர்",
      "VerbForm=Fin":   "முற்று வினை",
      "VerbForm=Part":  "பெயரெச்சம்",
      "VerbForm=Conv":  "வினையெச்சம்",
      "VerbForm=Vnoun": "வினையெழுச்சி",
      // Voice
      "Voice=Act":  "கர்த்தரி வினை",
      "Voice=Pass": "கர்மணி வினை",
      // Polarity
      "Polarity=Pos": "உடன்பாடு",
      "Polarity=Neg": "எதிர்மறை",
      // Animacy
      "Animacy=Anim":   "உயிர்ப்பு",
      "Animacy=Inanim": "உயிரற்ற",
      // NumType
      "NumType=Card": "அடிப்படை எண்",
      "NumType=Ord":  "வரிசை எண்",
      // Degree
      "Degree=Pos":  "சாதாரண நிலை",
      "Degree=Cmp":  "ஒப்பிட்டு நிலை",
      "Degree=Sup":  "மிகை நிலை",
      // Mood
      "Mood=Ind":  "நேர் சொல்",
      "Mood=Imp":  "கட்டளை",
      "Mood=Sub":  "ஐயநிலை",
    };

    const MORPH_SINHALA = {
      // Case
      "Case=Nom":  "කර්තෘ කාරකය",
      "Case=Acc":  "කර්ම කාරකය",
      "Case=Dat":  "සම්ප්රදාන කාරකය",
      "Case=Gen":  "ෂෂ්ඨී කාරකය",
      "Case=Loc":  "අධිකරණ කාරකය",
      "Case=Abl":  "පඤ්චමී කාරකය",
      "Case=Ins":  "කරණ කාරකය",
      "Case=Voc":  "සම්බෝධන කාරකය",
      // Number
      "Number=Sing": "එකවචන",
      "Number=Plur": "බහුවචන",
      // Gender
      "Gender=Masc": "පුල්ලිංග",
      "Gender=Fem":  "ස්ත්රීලිංග",
      "Gender=Neut": "නපුංසකලිංග",
      "Gender=Com":  "සාමාන්ය ලිංග",
      // Person
      "Person=1": "උත්තම පුරුෂ",
      "Person=2": "මධ්යම පුරුෂ",
      "Person=3": "ප්රථම පුරුෂ",
      // Tense
      "Tense=Past":  "අතීත කාලය",
      "Tense=Pres":  "වර්තමාන කාලය",
      "Tense=Fut":   "අනාගත කාලය",
      // VerbForm
      "VerbForm=Inf":  "අනන්ත ක්රියා",
      "VerbForm=Fin":  "සීමිත ක්රියා",
      "VerbForm=Part": "කෘදන්ත",
      "VerbForm=Conv": "ගෙරුන්ඩ්",
      // Voice
      "Voice=Act":  "කර්තරී",
      "Voice=Pass": "කර්මකාරක",
      // Polarity
      "Polarity=Pos": "ධනාත්මක",
      "Polarity=Neg": "ඍණාත්මක",
      // Animacy
      "Animacy=Anim":   "සජීවී",
      "Animacy=Inanim": "අජීවී",
      // NumType
      "NumType=Card": "සංඛ්යාව",
      "NumType=Ord":  "අනුක්රමික",
      // Degree
      "Degree=Pos":  "සාමාන්ය",
      "Degree=Cmp":  "සැසඳීම",
      "Degree=Sup":  "උපරිම",
      // Mood
      "Mood=Ind":  "ප්රකාශාත්මක",
      "Mood=Imp":  "අණ",
      "Mood=Sub":  "සාපේක්ෂ",
    };

    const MORPH_EN = {
      "Case=Nom":  "Nominative", "Case=Acc": "Accusative",
      "Case=Dat":  "Dative",     "Case=Gen": "Genitive",
      "Case=Loc":  "Locative",   "Case=Abl": "Ablative",
      "Case=Ins":  "Instrumental","Case=Voc": "Vocative",
      "Number=Sing": "Singular", "Number=Plur": "Plural",
      "Gender=Masc": "Masculine","Gender=Fem": "Feminine",
      "Gender=Neut": "Neuter",   "Gender=Com": "Common",
      "Person=1": "1st Person",  "Person=2": "2nd Person", "Person=3": "3rd Person",
      "Tense=Past": "Past",      "Tense=Pres": "Present",  "Tense=Fut": "Future",
      "VerbForm=Inf": "Infinitive","VerbForm=Fin": "Finite",
      "VerbForm=Part": "Participle","VerbForm=Conv": "Converb",
      "Voice=Act": "Active",     "Voice=Pass": "Passive",
      "Polarity=Pos": "Positive","Polarity=Neg": "Negative",
      "Animacy=Anim": "Animate", "Animacy=Inanim": "Inanimate",
      "NumType=Card": "Cardinal","NumType=Ord": "Ordinal",
      "Degree=Pos": "Positive",  "Degree=Cmp": "Comparative","Degree=Sup": "Superlative",
      "Mood=Ind": "Indicative",  "Mood=Imp": "Imperative",  "Mood=Sub": "Subjunctive",
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
            <Link to="/" className="muted" style={{ fontSize: 13, marginBottom: 6, display: "inline-block" }}>← Dashboard</Link>
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
              className="btn btn-ghost btn-sm"
              title="Download complete document data, metadata, and NLP analysis"
              onClick={() => downloadDocumentFile(id, "json")}
            >
              ↓ JSON
            </button>
            <button
              className="btn btn-ghost btn-sm"
              title="Download token-level NLP analysis for Excel and data analysis"
              onClick={() => downloadDocumentFile(id, "csv")}
            >
              ↓ CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card fade-up fade-up-1">
        <div className="tabs">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`tab-btn${tab === key ? " active" : ""}`}
              onClick={() => setTab(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "cleaned"  && <pre className="snippet">{doc.cleaned_text}</pre>}
        {tab === "raw"      && <pre className="snippet">{doc.raw_text}</pre>}
        {tab === "metadata" && <pre className="snippet">{JSON.stringify(doc.metadata, null, 2)}</pre>}

        {tab === "nlp" && doc.nlp && (
          <div>

            {/* ── 1. Language Detection ── */}
            <div style={section}>
              <h3 style={sectionHead}>Language Detection</h3>
              <span className="pos-chip" style={{ fontSize: 14, padding: "6px 16px", fontWeight: 600 }}>
                {doc.nlp.language_display || doc.nlp.language}
              </span>
              <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>
                {doc.nlp.token_count?.toLocaleString()} tokens ·{" "}
                {doc.nlp.unique_tokens?.toLocaleString()} unique ·{" "}
                {doc.nlp.sentence_count} sentences
              </span>
            </div>

            {/* ── 2. Sentiment Analysis ── */}
            {doc.nlp.sentiment && Object.keys(doc.nlp.sentiment).length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}>Sentiment Analysis</h3>
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

            {/* ── 3. Text Classification ── */}
            {doc.nlp.classification && Object.keys(doc.nlp.classification).length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}>Text Classification</h3>
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

            {/* ── 4. Named Entity Recognition (NER) ── */}
            {doc.nlp.entities?.length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}>
                  Named Entity Recognition — NER ({doc.nlp.entities.length})
                </h3>
                <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                  {isTamil ? "நபர்கள், இடங்கள், நிறுவனங்களை அடையாளம் காண்கிறது" :
                   isSinhala ? "පුද්ගලයන්, ස්ථාන, සංවිධාන හඳුනා ගනී" :
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
                          e.label_en === "PER" || e.label === "Person" || e.label === "நபர்" || e.label === "පුද්ගල නාමය" ? "#e8f4fd" :
                          e.label_en === "ORG" || e.label === "Organization" || e.label === "நிறுவனம்" || e.label === "සංවිධානය" ? "#fef3e2" :
                          e.label_en === "LOC" || e.label === "Location" || e.label === "இடம்" || e.label === "ස්ථාන නාමය" ? "#e8fdf0" :
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
                    { color: "#e8f4fd", label: isTamil ? "நபர்" : isSinhala ? "පුද්ගල" : "Person" },
                    { color: "#fef3e2", label: isTamil ? "நிறுவனம்" : isSinhala ? "සංවිධාන" : "Organization" },
                    { color: "#e8fdf0", label: isTamil ? "இடம்" : isSinhala ? "ස්ථාන" : "Location" },
                  ].map((item, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: 3,
                        background: item.color, border: "1px solid #ccc", display: "inline-block",
                      }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── 5. POS Tagging ── */}
            <div style={section}>
              <h3 style={sectionHead}>Part-of-Speech (POS) Distribution</h3>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {isTamil ? "வார்த்தைகளை பெயர்ச்சொல், வினைச்சொல், பெயரடை என வகைப்படுத்துகிறது" :
                 isSinhala ? "වචන නාම, ක්රියා, විශේෂණ ලෙස වර්ගීකරණය කරයි" :
                 "Identifies nouns, verbs, adjectives, and other grammatical categories"}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(doc.nlp.pos_distribution || {}).map(([pos, n]) => (
                  <span key={pos} className="pos-chip">{POS_LABELS[pos] || pos}: {n}</span>
                ))}
              </div>
            </div>

            {/* ── 6. Tokenization ── */}
            <div style={section}>
              <h3 style={sectionHead}>Tokenization (first 200)</h3>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {isTamil ? "உரையை தனிப்பட்ட வார்த்தைகளாக பிரிக்கிறது" :
                 isSinhala ? "පෙළ තනි වචනවලට බෙදා වෙන් කරයි" :
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

            {/* ── 7. Lemmatization ── */}
            <div style={section}>
              <h3 style={sectionHead}>Lemmatization</h3>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {isTamil ? "வார்த்தைகளை அவற்றின் மூல வடிவத்திற்கு குறைக்கிறது" :
                 isSinhala ? "වචන ඒවායේ මූල ස්වරූපයට අඩු කරයි" :
                 "Reduces words to their base dictionary form (e.g. 'running' → 'run')"}
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
                      <span style={{ color: "var(--ink-lt)" }}>→</span>
                      <span style={{ color: "var(--forest)" }}>{t.lemma}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>
                  {isTamil ? "அனைத்து வார்த்தைகளும் ஏற்கனவே மூல வடிவத்தில் உள்ளன" :
                   isSinhala ? "සියලුම වචන දැනටමත් මූල ස්වරූපයේ ඇත" :
                   "All words are already in their base form"}
                </p>
              )}
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                {lemmaPairs.length} word{lemmaPairs.length !== 1 ? "s" : ""} reduced to base form
              </p>
            </div>

            {/* ── 8. Morphological Analysis ── */}
            <div style={section}>
              <h3 style={sectionHead}>Morphological Analysis</h3>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {isTamil ? "வார்த்தைகளின் இலக்கண அமைப்பை பகுப்பாய்வு செய்கிறது" :
                 isSinhala ? "වචනවල ව්යාකරණ ව්යුහය විශ්ලේෂණය කරයි" :
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
                          {isTamil ? "வார்த்தை" : isSinhala ? "වචනය" : "Word"}
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "மூல வடிவம்" : isSinhala ? "මූල ස්වරූපය" : "Lemma"}
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "இலக்கண வகை" : isSinhala ? "ව්යාකරණ වර්ගය" : "POS"}
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "உருபியல் தகவல்" : isSinhala ? "රූපවිද්යා තොරතුරු" : "Morphology"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {morphTokens.map((t, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "4px 8px", fontWeight: 600 }}>{t.text}</td>
                          <td style={{ padding: "4px 8px", color: "var(--forest)" }}>{t.lemma}</td>
                          <td style={{ padding: "4px 8px" }}>{POS_LABELS[t.pos] || t.pos}</td>
                          <td style={{ padding: "4px 8px", color: "var(--ink-lt)", fontSize: 12 }}>
                            {translateMorph(t.morph, doc.nlp.language)}
                          </td>
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
                          {isTamil ? "வார்த்தை" : isSinhala ? "වචනය" : "Word"}
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "மூல வடிவம்" : isSinhala ? "මූල ස්වරූපය" : "Lemma"}
                        </th>
                        <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--ink-lt)" }}>
                          {isTamil ? "இலக்கண வகை" : isSinhala ? "ව්යාකරණ වර්ගය" : "POS"}
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

            {/* ── 9. Sentences ── */}
            {doc.nlp.sentences?.length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}>Sentences ({doc.nlp.sentence_count})</h3>
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
            <h3 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", marginBottom: 20 }}>
              POS Distribution
            </h3>
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
            <h3 style={{ fontFamily: "var(--font-head)", color: "var(--forest)", margin: "28px 0 20px" }}>
              Top Words
            </h3>
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
