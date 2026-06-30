import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getDocument, exportDocument  } from "../api";

const PIE_COLORS = ["#1a3a2a","#4a7c59","#8fb89a","#d4e8d0","#2d5a3d","#6aaa80","#b0d8b8","#386641"];

function PdfTypeBadge({ pdfType }) {
  if (!pdfType) return null;
  const config = {
    text_only:  { label: "Text Only PDF",      bg: "#e8f5e9", color: "#2d6a4f", icon: "📄" },
    text_image: { label: "Text + Images PDF",   bg: "#fff8e1", color: "#b45309", icon: "🖼️" },
    image_only: { label: "Scanned / Image PDF", bg: "#fce4ec", color: "#c62828", icon: "📷" },
  };
  const c = config[pdfType] || { label: pdfType, bg: "#f5f5f5", color: "#555", icon: "📄" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:c.bg,
      color:c.color, borderRadius:20, padding:"4px 12px", fontSize:13, fontWeight:600 }}>
      {c.icon} {c.label}
    </span>
  );
}

export default function DocumentView() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState("overview");
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

  const isTamil   = doc?.nlp?.language === "Tamil";
  const isSinhala = doc?.nlp?.language === "Sinhala";

  const sentimentColor = (labelEn) => {
    if (!labelEn) return "#f0f0f0";
    const l = labelEn.toLowerCase();
    if (l === "positive") return "#d4edda";
    if (l === "negative") return "#f8d7da";
    return "#fff3cd";
  };

  const sectionHead = { fontFamily:"var(--font-head)", color:"var(--forest)", marginBottom:10, marginTop:0 };
  const section = { marginBottom: 28 };

  const lemmaPairs = (doc.nlp?.token_details || [])
    .filter(t => t.lemma && t.text !== t.lemma)
    .slice(0, 100);

  const morphTokens = (doc.nlp?.token_details || [])
    .filter(t => t.morph && t.morph !== "")
    .slice(0, 50);

  const translateMorph = (morphStr, lang) => {
    if (!morphStr) return "";
    const MORPH_TAMIL = {
      "Case=Nom":"எழுவாய் வேற்றுமை","Case=Acc":"செயப்படுபொருள் வேற்றுமை",
      "Case=Dat":"கொடை வேற்றுமை","Case=Gen":"உடைமை வேற்றுமை",
      "Case=Loc":"இட வேற்றுமை","Case=Abl":"நீக்க வேற்றுமை",
      "Number=Sing":"ஒருமை","Number=Plur":"பன்மை",
      "Gender=Masc":"ஆண்பால்","Gender=Fem":"பெண்பால்","Gender=Neut":"நடுப்பால்",
      "Person=1":"முன்னிலை","Person=2":"நேர்முகம்","Person=3":"படர்க்கை",
      "Tense=Past":"இறந்தகாலம்","Tense=Pres":"நிகழ்காலம்","Tense=Fut":"எதிர்காலம்",
      "VerbForm=Inf":"தொழிற்பெயர்","VerbForm=Fin":"முற்று வினை",
      "VerbForm=Part":"பெயரெச்சம்","VerbForm=Conv":"வினையெச்சம்",
      "Voice=Act":"கர்த்தரி வினை","Voice=Pass":"கர்மணி வினை",
      "Polarity=Pos":"உடன்பாடு","Polarity=Neg":"எதிர்மறை",
    };
    const MORPH_SINHALA = {
      "Case=Nom":"කර්තෘ කාරකය","Case=Acc":"කර්ම කාරකය",
      "Number=Sing":"එකවචන","Number=Plur":"බහුවචන",
      "Gender=Masc":"පුල්ලිංග","Gender=Fem":"ස්ත්‍රීලිංග",
      "Tense=Past":"අතීත කාලය","Tense=Pres":"වර්තමාන කාලය","Tense=Fut":"අනාගත කාලය",
      "Voice=Act":"කර්තරී","Voice=Pass":"කර්මකාරක",
    };
    const MORPH_EN = {
      "Case=Nom":"Nominative","Case=Acc":"Accusative","Number=Sing":"Singular",
      "Number=Plur":"Plural","Gender=Masc":"Masculine","Gender=Fem":"Feminine",
      "Tense=Past":"Past","Tense=Pres":"Present","Tense=Fut":"Future",
      "VerbForm=Inf":"Infinitive","VerbForm=Fin":"Finite","VerbForm=Part":"Participle",
      "Voice=Act":"Active","Voice=Pass":"Passive","Polarity=Pos":"Positive","Polarity=Neg":"Negative",
    };
    const map = lang === "Tamil" ? MORPH_TAMIL : lang === "Sinhala" ? MORPH_SINHALA : MORPH_EN;
    return morphStr.split("|").map(feat => map[feat] || feat).join(" | ");
  };

  const TABS = [
    { key:"overview", label:"Overview" },
    { key:"cleaned",  label:"Cleaned"  },
    { key:"raw",      label:"Raw"      },
    { key:"nlp",      label:"NLP Data" },
    { key:"charts",   label:"Charts"   },
    { key:"metadata", label:"Metadata" },
  ];

  return (
    <div className="page">
      <div className="page-header fade-up">
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
          <div style={{ flex:1 }}>
            <Link to="/" className="muted" style={{ fontSize:13, marginBottom:6, display:"inline-block" }}>← Dashboard</Link>
            <h1 className="page-title" style={{ wordBreak:"break-word" }}>{doc.filename}</h1>
            <div style={{ display:"flex", gap:10, marginTop:8, alignItems:"center", flexWrap:"wrap" }}>
              <span className="badge">{doc.file_type}</span>
              {doc.file_type === "pdf" && <PdfTypeBadge pdfType={doc.pdf_type} />}
              {doc.nlp?.language && (
                <span className="badge">{doc.nlp.language_display || doc.nlp.language}</span>
              )}
              <span className="muted">{new Date(doc.created_at).toLocaleDateString()}</span>
              {doc.nlp?.token_count && (
                <span className="muted">{doc.nlp.token_count.toLocaleString()} tokens</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            title="Download complete document data, metadata, and NLP analysis"
            onClick={() => exportDocument(id, "json", doc.filename?.split(".")[0] || "document")}
          >
            JSON
          </button>

          <button
            className="btn btn-ghost btn-sm"
            type="button"
            title="Download token-level NLP analysis for Excel and data analysis"
            onClick={() => exportDocument(id, "csv", doc.filename?.split(".")[0] || "document")}
          >
            CSV
          </button>
        </div>
        </div>
      </div>

      <div className="card fade-up fade-up-1">
        <div className="tabs">
          {TABS.map(({ key, label }) => (
            <button key={key} className={`tab-btn${tab===key?" active":""}`}
              onClick={() => setTab(key)} type="button">{label}</button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div style={{ padding:"8px 0" }}>
            <div style={{ background:"var(--mint)", border:"1px solid var(--border)",
              borderRadius:10, padding:"16px 20px", marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--forest)",
                textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>
                📋 Document Summary
              </div>
              <p style={{ margin:0, fontSize:15, lineHeight:1.7, color:"var(--ink)" }}>
                {doc.summary || "No summary available."}
              </p>
            </div>
            {doc.file_type === "pdf" && doc.pdf_type && (
              <div style={{ background:"#fff", border:"1px solid var(--border)",
                borderRadius:10, padding:"16px 20px", marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--forest)",
                  textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>📄 PDF Type</div>
                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                  <PdfTypeBadge pdfType={doc.pdf_type} />
                  <span style={{ fontSize:13, color:"var(--ink-lt)" }}>
                    {doc.pdf_type==="text_only" && "This PDF contains only selectable text."}
                    {doc.pdf_type==="text_image" && "This PDF contains text and images. OCR applied to image pages."}
                    {doc.pdf_type==="image_only" && "This is a scanned PDF. Full OCR applied."}
                  </span>
                </div>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",
              gap:12, marginBottom:20 }}>
              {[
                { label:"File Type",     value: doc.file_type?.toUpperCase() },
                { label:"Language",      value: doc.nlp?.language_display || doc.nlp?.language || "—" },
                { label:"Tokens",        value: doc.nlp?.token_count?.toLocaleString() || "—" },
                { label:"Unique Tokens", value: doc.nlp?.unique_tokens?.toLocaleString() || "—" },
                { label:"Sentences",     value: doc.nlp?.sentence_count?.toLocaleString() || "—" },
                { label:"Uploaded",      value: new Date(doc.created_at).toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label} style={{ background:"var(--bg-lt)", borderRadius:8,
                  padding:"12px 16px", textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:700, color:"var(--forest)" }}>{value}</div>
                  <div style={{ fontSize:11, color:"var(--ink-lt)", marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
            {doc.nlp?.top_keywords?.length > 0 && (
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--forest)",
                  textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>🔑 Top Keywords</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {doc.nlp.top_keywords.map((kw, i) => (
                    <span key={i} style={{ background:"var(--forest)", color:"#fff",
                      borderRadius:20, padding:"4px 14px", fontSize:13 }}>{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "cleaned"  && <pre className="snippet">{doc.cleaned_text}</pre>}
        {tab === "raw"      && <pre className="snippet">{doc.raw_text}</pre>}
        {tab === "metadata" && <pre className="snippet">{JSON.stringify(doc.metadata, null, 2)}</pre>}

        {/* NLP DATA */}
        {tab === "nlp" && doc.nlp && (
          <div>

            {/* 1. Language */}
            <div style={section}>
              <h3 style={sectionHead}>🌐 Language Detection</h3>
              <span className="pos-chip" style={{ fontSize:14, padding:"6px 16px", fontWeight:600 }}>
                {doc.nlp.language_display || doc.nlp.language}
              </span>
              <span className="muted" style={{ marginLeft:10, fontSize:13 }}>
                {doc.nlp.token_count?.toLocaleString()} tokens ·{" "}
                {doc.nlp.unique_tokens?.toLocaleString()} unique ·{" "}
                {doc.nlp.sentence_count} sentences
              </span>
            </div>

            {/* 2. Sentiment */}
            {doc.nlp.sentiment && Object.keys(doc.nlp.sentiment).length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}>😊 Sentiment Analysis</h3>
                <span className="pos-chip" style={{
                  background: sentimentColor(doc.nlp.sentiment.label_en),
                  fontSize:15, padding:"8px 20px", fontWeight:600 }}>
                  {doc.nlp.sentiment.label}
                </span>
                <span className="muted" style={{ marginLeft:10, fontSize:13 }}>
                  {(doc.nlp.sentiment.score * 100).toFixed(1)}% confidence
                </span>
              </div>
            )}

            {/* 3. Classification */}
            {doc.nlp.classification && Object.keys(doc.nlp.classification).length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}>🏷️ Text Classification</h3>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {(doc.nlp.classification.all || []).slice(0, 8).map((c, i) => (
                    <span key={i} className="pos-chip" style={{
                      background: i===0 ? "var(--mint)" : undefined,
                      fontWeight: i===0 ? 700 : 400, fontSize:13 }}>
                      {c.label}: {(c.score * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 4. NER */}
            {doc.nlp.entities?.length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}>🔍 Named Entity Recognition ({doc.nlp.entities.length})</h3>
                <p className="muted" style={{ fontSize:12, marginBottom:10 }}>
                  {isTamil ? "நபர்கள், இடங்கள், நிறுவனங்களை அடையாளம் காண்கிறது" :
                   isSinhala ? "පුද්ගලයන්, ස්ථාන, සංවිධාන හඳුනා ගනී" :
                   "Identifies people, places, and organizations"}
                </p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {doc.nlp.entities.slice(0, 100).map((e, i) => (
                    <span key={i} className="pos-chip" title={`Score: ${e.score}`} style={{
                      background:
                        (e.label_en==="PER"||e.label==="Person"||e.label==="நபர்") ? "#e8f4fd" :
                        (e.label_en==="ORG"||e.label==="Organization"||e.label==="நிறுவனம்") ? "#fef3e2" :
                        (e.label_en==="LOC"||e.label==="Location"||e.label==="இடம்") ? "#e8fdf0" : undefined
                    }}>
                      {e.text} <em>({e.label})</em>
                    </span>
                  ))}
                </div>
                <div style={{ display:"flex", gap:12, marginTop:10, flexWrap:"wrap" }}>
                  {[
                    { color:"#e8f4fd", label: isTamil?"நபர்":isSinhala?"පුද්ගල":"Person" },
                    { color:"#fef3e2", label: isTamil?"நிறுவனம்":isSinhala?"සංවිධාන":"Organization" },
                    { color:"#e8fdf0", label: isTamil?"இடம்":isSinhala?"ස්ථාන":"Location" },
                  ].map((item,i) => (
                    <span key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12 }}>
                      <span style={{ width:12, height:12, borderRadius:3, background:item.color,
                        border:"1px solid #ccc", display:"inline-block" }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 5. POS */}
            <div style={section}>
              <h3 style={sectionHead}>📝 Part-of-Speech Distribution</h3>
              <p className="muted" style={{ fontSize:12, marginBottom:10 }}>
                {isTamil ? "வார்த்தைகளை பெயர்ச்சொல், வினைச்சொல், பெயரடை என வகைப்படுத்துகிறது" :
                 isSinhala ? "වචන නාම, ක්‍රියා, විශේෂණ ලෙස වර්ගීකරණය කරයි" :
                 "Identifies nouns, verbs, adjectives, and other grammatical categories"}
              </p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {Object.entries(doc.nlp.pos_distribution || {}).map(([pos, n]) => (
                  <span key={pos} className="pos-chip">{pos}: {n}</span>
                ))}
              </div>
            </div>

            {/* 6. Tokenization */}
            <div style={section}>
              <h3 style={sectionHead}>🔤 Tokenization (first 200)</h3>
              <p className="muted" style={{ fontSize:12, marginBottom:10 }}>
                {isTamil ? "உரையை தனிப்பட்ட வார்த்தைகளாக பிரிக்கிறது" :
                 isSinhala ? "පෙළ තනි වචනවලට බෙදා වෙන් කරයි" :
                 "Splits text into individual words with their grammatical role"}
              </p>
              <div className="snippet" style={{ maxHeight:240 }}>
                {(doc.nlp.token_details || []).slice(0, 200).map((t, i) => (
                  <span key={i} className="pos-chip" title={t.tag}>
                    {t.text} <em>({t.tag || t.pos})</em>
                  </span>
                ))}
              </div>
            </div>

            {/* 7. Lemmatization */}
            <div style={section}>
              <h3 style={sectionHead}>📚 Lemmatization</h3>
              <p className="muted" style={{ fontSize:12, marginBottom:10 }}>
                {isTamil ? "வார்த்தைகளை அவற்றின் மூல வடிவத்திற்கு குறைக்கிறது" :
                 isSinhala ? "වචන ඒවායේ මූල ස්වරූපයට අඩු කරයි" :
                 "Reduces words to their base dictionary form (e.g. 'running' → 'run')"}
              </p>
              {lemmaPairs.length > 0 ? (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",
                  gap:8, maxHeight:240, overflowY:"auto", background:"var(--paper)",
                  borderRadius:"var(--radius)", padding:12 }}>
                  {lemmaPairs.map((t, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8,
                      fontSize:13, padding:"4px 0", borderBottom:"1px solid var(--border)" }}>
                      <span style={{ fontWeight:600, color:"var(--ink)" }}>{t.text}</span>
                      <span style={{ color:"var(--ink-lt)" }}>→</span>
                      <span style={{ color:"var(--forest)" }}>{t.lemma}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize:13 }}>All words are already in base form</p>
              )}
              <p className="muted" style={{ fontSize:12, marginTop:8 }}>
                {lemmaPairs.length} word{lemmaPairs.length!==1?"s":""} reduced to base form
              </p>
            </div>

            {/* 8. Morphological Analysis */}
            <div style={section}>
              <h3 style={sectionHead}>🔬 Morphological Analysis</h3>
              <p className="muted" style={{ fontSize:12, marginBottom:10 }}>
                {isTamil ? "வார்த்தைகளின் இலக்கண அமைப்பை பகுப்பாய்வு செய்கிறது" :
                 isSinhala ? "වචනවල ව්‍යාකරණ ව්‍යුහය විශ්ලේෂණය කරයි" :
                 "Analyzes grammatical structure (tense, number, case, gender)"}
              </p>
              <div style={{ maxHeight:240, overflowY:"auto", background:"var(--paper)",
                borderRadius:"var(--radius)", padding:12 }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr style={{ borderBottom:"2px solid var(--border)" }}>
                      <th style={{ textAlign:"left", padding:"4px 8px", color:"var(--ink-lt)" }}>
                        {isTamil?"வார்த்தை":isSinhala?"වචනය":"Word"}
                      </th>
                      <th style={{ textAlign:"left", padding:"4px 8px", color:"var(--ink-lt)" }}>
                        {isTamil?"மூல வடிவம்":isSinhala?"මූල ස්වරූපය":"Lemma"}
                      </th>
                      <th style={{ textAlign:"left", padding:"4px 8px", color:"var(--ink-lt)" }}>
                        {isTamil?"இலக்கண வகை":isSinhala?"ව්‍යාකරණ වර්ගය":"POS"}
                      </th>
                      {morphTokens.length > 0 && (
                        <th style={{ textAlign:"left", padding:"4px 8px", color:"var(--ink-lt)" }}>
                          {isTamil?"உருபியல் தகவல்":isSinhala?"රූපවිද්‍යා":"Morphology"}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(morphTokens.length > 0 ? morphTokens : (doc.nlp.token_details||[]).slice(0,50))
                      .map((t, i) => (
                        <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                          <td style={{ padding:"4px 8px", fontWeight:600 }}>{t.text}</td>
                          <td style={{ padding:"4px 8px", color:"var(--forest)" }}>{t.lemma}</td>
                          <td style={{ padding:"4px 8px" }}>{t.tag || t.pos}</td>
                          {morphTokens.length > 0 && (
                            <td style={{ padding:"4px 8px", color:"var(--ink-lt)", fontSize:12 }}>
                              {translateMorph(t.morph, doc.nlp.language)}
                            </td>
                          )}
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 9. Sentences */}
            {doc.nlp.sentences?.length > 0 && (
              <div style={section}>
                <h3 style={sectionHead}>📖 Sentences ({doc.nlp.sentence_count})</h3>
                <div style={{ maxHeight:200, overflowY:"auto", background:"var(--paper)",
                  borderRadius:"var(--radius)", padding:12 }}>
                  {doc.nlp.sentences.slice(0, 20).map((s, i) => (
                    <p key={i} style={{ margin:"4px 0", fontSize:13,
                      borderBottom:"1px solid var(--border)", paddingBottom:4 }}>
                      <span style={{ color:"var(--ink-lt)", marginRight:8 }}>{i+1}.</span>{s}
                    </p>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* CHARTS */}
        {tab === "charts" && doc.nlp && (
          <div>
            <h3 style={{ fontFamily:"var(--font-head)", color:"var(--forest)", marginBottom:20 }}>POS Distribution</h3>
            <div style={{ width:"100%", height:280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={posData} dataKey="count" nameKey="pos" cx="50%" cy="50%" outerRadius={100} label>
                    {posData.map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <h3 style={{ fontFamily:"var(--font-head)", color:"var(--forest)", margin:"28px 0 20px" }}>Top Words</h3>
            <div style={{ width:"100%", height:340 }}>
              <ResponsiveContainer>
                <BarChart data={topWordsData} layout="vertical" margin={{ left:60 }}>
                  <XAxis type="number" tick={{ fontSize:12 }} />
                  <YAxis type="category" dataKey="word" tick={{ fontSize:12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1a3a2a" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}