import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getDocument, exportDocument } from "../api";

const PIE_COLORS = ["#1a3a2a","#4a7c59","#8fb89a","#d4e8d0","#2d5a3d","#6aaa80","#b0d8b8","#386641"];

function PdfTypeBadge({ pdfType }) {
  if (!pdfType) return null;
  const config = {
    text_only:  { label:"Text Only PDF",      bg:"#e8f5e9", color:"#2d6a4f", icon:"📄" },
    text_image: { label:"Text + Images PDF",   bg:"#fff8e1", color:"#b45309", icon:"🖼️" },
    image_only: { label:"Scanned / Image PDF", bg:"#fce4ec", color:"#c62828", icon:"📷" },
  };
  const c = config[pdfType] || { label:pdfType, bg:"#f5f5f5", color:"#555", icon:"📄" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, background:c.bg,
      color:c.color, borderRadius:20, padding:"4px 12px", fontSize:13, fontWeight:600 }}>
      {c.icon} {c.label}
    </span>
  );
}

// ── NLP Sidebar sections ───────────────────────────────────
const NLP_SECTIONS = [
  { key:"language",       label:"Language Detection",      },
  { key:"sentiment",      label:"Sentiment Analysis",       },
  { key:"classification", label:"Text Classification",     },
  { key:"ner",            label:"Named Entities",          },
  { key:"pos",            label:"Part-of-Speech",         },
  { key:"tokens",         label:"Tokenization",            },
  { key:"lemma",          label:"Lemmatization",            },
  { key:"morph",          label:"Morphological Analysis",   },
  { key:"sentences",      label:"Sentences",              },
];

export default function DocumentView() {
  const { id } = useParams();
  const [doc, setDoc]       = useState(null);
  const [tab, setTab]       = useState("overview");
  const [nlpSec, setNlpSec] = useState("language");
  const [error, setError]   = useState("");

  useEffect(() => {
    getDocument(id)
      .then(setDoc)
      .catch((e) => setError(e.response?.data?.detail || "Failed to load document."));
  }, [id]);

  if (error) return (
    <div className="page" style={{ maxWidth:720 }}>
      <div className="alert-error">{error}</div>
      <Link to="/" className="btn btn-ghost btn-sm">← Back to dashboard</Link>
    </div>
  );
  if (!doc) return <div className="page"><p className="muted">Loading…</p></div>;

  const posData      = Object.entries(doc.nlp?.pos_distribution || {}).map(([pos,count])=>({pos,count})).sort((a,b)=>b.count-a.count);
  const topWordsData = (doc.nlp?.top_words||[]).slice(0,15).map(([word,count])=>({word,count}));

  const isTamil   = doc?.nlp?.language === "Tamil";
  const isSinhala = doc?.nlp?.language === "Sinhala";

  const sentimentColor = (labelEn) => {
    if (!labelEn) return "#f0f0f0";
    const l = labelEn.toLowerCase();
    if (l==="positive") return "#d4edda";
    if (l==="negative") return "#f8d7da";
    return "#fff3cd";
  };

  const lemmaPairs  = (doc.nlp?.token_details||[]).filter(t=>t.lemma&&t.text!==t.lemma).slice(0,100);
  const morphTokens = (doc.nlp?.token_details||[]).filter(t=>t.morph&&t.morph!=="").slice(0,50);

  const translateMorph = (morphStr, lang) => {
    if (!morphStr) return "";
    const MORPH_EN = {
      "Case=Nom":"Nominative","Case=Acc":"Accusative","Number=Sing":"Singular",
      "Number=Plur":"Plural","Gender=Masc":"Masculine","Gender=Fem":"Feminine",
      "Tense=Past":"Past","Tense=Pres":"Present","Tense=Fut":"Future",
      "VerbForm=Inf":"Infinitive","VerbForm=Fin":"Finite","VerbForm=Part":"Participle",
      "Voice=Act":"Active","Voice=Pass":"Passive",
    };
    const MORPH_TAMIL = {
      "Case=Nom":"எழுவாய் வேற்றுமை","Case=Acc":"செயப்படுபொருள் வேற்றுமை",
      "Number=Sing":"ஒருமை","Number=Plur":"பன்மை",
      "Tense=Past":"இறந்தகாலம்","Tense=Pres":"நிகழ்காலம்","Tense=Fut":"எதிர்காலம்",
      "VerbForm=Inf":"தொழிற்பெயர்","VerbForm=Fin":"முற்று வினை",
      "Voice=Act":"கர்த்தரி வினை","Voice=Pass":"கர்மணி வினை",
    };
    const MORPH_SINHALA = {
      "Case=Nom":"කර්තෘ කාරකය","Case=Acc":"කර්ම කාරකය",
      "Number=Sing":"එකවචන","Number=Plur":"බහුවචන",
      "Tense=Past":"අතීත කාලය","Tense=Pres":"වර්තමාන කාලය","Tense=Fut":"අනාගත කාලය",
      "Voice=Act":"කර්තරී","Voice=Pass":"කර්මකාරක",
    };
    const map = lang==="Tamil" ? MORPH_TAMIL : lang==="Sinhala" ? MORPH_SINHALA : MORPH_EN;
    return morphStr.split("|").map(f=>map[f]||f).join(" | ");
  };

  const TABS = [
    { key:"overview", label:"Overview" },
    { key:"cleaned",  label:"Cleaned"  },
    { key:"raw",      label:"Raw"      },
    { key:"nlp",      label:"NLP Data" },
    { key:"charts",   label:"Charts"   },
    { key:"metadata", label:"Metadata" },
  ];

  // ── Shared styles ──────────────────────────────────────
  const scrollBox = {
    maxHeight:260, overflowY:"auto",
    border:"1px solid var(--border)",
    borderRadius:8, background:"var(--paper)",
  };
  const th = {
    textAlign:"left", padding:"9px 12px",
    fontSize:11, fontWeight:700, letterSpacing:"0.06em",
    textTransform:"uppercase", color:"var(--ink-lt)",
    background:"var(--bg-lt)", borderBottom:"2px solid var(--border)",
  };
  const td = (z) => ({
    padding:"8px 12px", borderBottom:"1px solid var(--border)",
    background: z ? "var(--bg-lt)" : "transparent",
  });

  // ── NLP section renderer ───────────────────────────────
  const renderNlpSection = () => {
    const nlp = doc.nlp;
    if (!nlp) return null;

    switch (nlpSec) {

      case "language":
        return (
          <div>
            <div style={{ marginBottom:20 }}>
              <span style={{ display:"inline-block", background:"var(--mint)",
                color:"var(--forest)", borderRadius:8, padding:"10px 24px",
                fontSize:17, fontWeight:700 }}>
                {nlp.language_display || nlp.language}
              </span>
            </div>
            <div style={{ display:"flex", gap:28, flexWrap:"wrap" }}>
              {[
                { val: nlp.token_count?.toLocaleString(),  label:"Tokens"    },
                { val: nlp.unique_tokens?.toLocaleString(), label:"Unique"   },
                { val: nlp.sentence_count,                  label:"Sentences" },
              ].map(({ val, label }) => (
                <div key={label} style={{ textAlign:"center", background:"var(--bg-lt)",
                  borderRadius:10, padding:"16px 24px", minWidth:100 }}>
                  <div style={{ fontSize:26, fontWeight:700, color:"var(--forest)" }}>{val ?? "—"}</div>
                  <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.06em",
                    color:"var(--ink-lt)", marginTop:4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case "sentiment":
        if (!nlp.sentiment || !Object.keys(nlp.sentiment).length) return <p className="muted">No sentiment data.</p>;
        return (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:20, flexWrap:"wrap" }}>
              <span style={{ display:"inline-block", background:sentimentColor(nlp.sentiment.label_en),
                borderRadius:8, padding:"12px 28px", fontSize:18, fontWeight:700 }}>
                {nlp.sentiment.label}
              </span>
              <div>
                <div style={{ fontSize:12, color:"var(--ink-lt)", marginBottom:6 }}>Confidence</div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:160, height:8, background:"var(--border)",
                    borderRadius:99, overflow:"hidden" }}>
                    <div style={{ width:`${(nlp.sentiment.score*100).toFixed(0)}%`,
                      height:"100%", background:"var(--forest)", borderRadius:99 }} />
                  </div>
                  <span style={{ fontSize:15, fontWeight:700, color:"var(--forest)" }}>
                    {(nlp.sentiment.score*100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case "classification":
        if (!nlp.classification || !Object.keys(nlp.classification).length) return <p className="muted">No classification data.</p>;
        return (
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {(nlp.classification.all||[]).slice(0,8).map((c,i) => (
              <span key={i} className="pos-chip" style={{
                background: i===0 ? "var(--mint)" : undefined,
                fontWeight: i===0 ? 700 : 400, fontSize:13,
                border: i===0 ? "1.5px solid var(--forest)" : undefined,
              }}>
                {i===0 && <span style={{ width:7,height:7,borderRadius:"50%",
                  background:"var(--forest)",display:"inline-block",marginRight:5 }} />}
                {c.label}: {(c.score*100).toFixed(1)}%
              </span>
            ))}
          </div>
        );

      case "ner":
        if (!nlp.entities?.length) return <p className="muted">No entities found.</p>;
        return (
          <div>
            <p className="muted" style={{ fontSize:12, marginBottom:14 }}>
              {isTamil ? "நபர்கள், இடங்கள், நிறுவனங்களை அடையாளம் காண்கிறது" :
               isSinhala ? "පුද්ගලයන්, ස්ථාන, සංවිධාන හඳුනා ගනී" :
               "Identifies people, places, and organizations"}
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {nlp.entities.slice(0,100).map((e,i) => {
                const bg =
                  (e.label_en==="PER"||e.label==="Person")       ? "#eff6ff" :
                  (e.label_en==="ORG"||e.label==="Organization")  ? "#fff7ed" :
                  (e.label_en==="LOC"||e.label==="Location"||e.label==="Country/City") ? "#f0fdf4" :
                  (e.label==="Date"||e.label==="Time")            ? "#fefce8" :
                  (e.label==="Money")                             ? "#fdf4ff" : "#f4f4f4";
                const dot =
                  (e.label_en==="PER"||e.label==="Person")       ? "#3b82f6" :
                  (e.label_en==="ORG"||e.label==="Organization")  ? "#f97316" :
                  (e.label_en==="LOC"||e.label==="Location"||e.label==="Country/City") ? "#22c55e" :
                  (e.label==="Date"||e.label==="Time")            ? "#eab308" :
                  (e.label==="Money")                             ? "#a855f7" : "#a8a29e";
                return (
                  <span key={i} title={`Score: ${e.score}`} style={{
                    display:"inline-flex", alignItems:"center", gap:6,
                    padding:"5px 10px", borderRadius:999,
                    background:bg, fontSize:13, fontWeight:500,
                    maxWidth:220, overflow:"hidden",
                  }}>
                    <span style={{ width:7,height:7,borderRadius:"50%",background:dot,flexShrink:0 }} />
                    <span style={{ overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{e.text}</span>
                    <em style={{ fontSize:11, opacity:0.65, fontStyle:"italic", flexShrink:0 }}>({e.label})</em>
                  </span>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:16, marginTop:14, flexWrap:"wrap" }}>
              {[
                { dot:"#3b82f6", label:"Person"       },
                { dot:"#f97316", label:"Organization" },
                { dot:"#22c55e", label:"Location"     },
                { dot:"#eab308", label:"Date / Time"  },
                { dot:"#a855f7", label:"Money"        },
                { dot:"#a8a29e", label:"Other"        },
              ].map(({ dot, label }) => (
                <span key={label} style={{ display:"flex", alignItems:"center", gap:6,
                  fontSize:12, color:"var(--ink-lt)" }}>
                  <span style={{ width:8,height:8,borderRadius:"50%",background:dot }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        );

      case "pos":
        return (
          <div>
            <p className="muted" style={{ fontSize:12, marginBottom:14 }}>
              {isTamil ? "வார்த்தைகளை பெயர்ச்சொல், வினைச்சொல், பெயரடை என வகைப்படுத்துகிறது" :
               isSinhala ? "වචන නාම, ක්‍රියා, විශේෂණ ලෙස වර්ගීකරණය කරයි" :
               "Identifies nouns, verbs, adjectives, and other grammatical categories"}
            </p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
              {Object.entries(nlp.pos_distribution||{}).map(([pos,n]) => (
                <span key={pos} className="pos-chip" style={{ border:"1px solid var(--border)" }}>
                  <strong>{pos}</strong>
                  <span style={{ color:"var(--ink-lt)", marginLeft:5 }}>{n}</span>
                </span>
              ))}
            </div>
          </div>
        );

      case "tokens":
        return (
          <div>
            <p className="muted" style={{ fontSize:12, marginBottom:14 }}>
              {isTamil ? "உரையை தனிப்பட்ட வார்த்தைகளாக பிரிக்கிறது" :
               isSinhala ? "පෙළ තනි වචනවලට බෙදා වෙන් කරයි" :
               "Splits text into individual words with their grammatical role — first 200"}
            </p>
            <div style={{ ...scrollBox, padding:14, display:"flex", flexWrap:"wrap", gap:6 }}>
              {(nlp.token_details||[]).slice(0,200).map((t,i) => (
                <span key={i} className="pos-chip" title={t.tag}
                  style={{ border:"1px solid var(--border)" }}>
                  {t.text}
                  <em style={{ color:"var(--ink-lt)", fontStyle:"normal", fontSize:11 }}> {t.tag||t.pos}</em>
                </span>
              ))}
            </div>
          </div>
        );

      case "lemma":
        return (
          <div>
            <p className="muted" style={{ fontSize:12, marginBottom:14 }}>
              {isTamil ? "வார்த்தைகளை அவற்றின் மூல வடிவத்திற்கு குறைக்கிறது" :
               isSinhala ? "වචන ඒවායේ මූල ස්වරූපයට අඩු කරයි" :
               "Reduces words to their base dictionary form — e.g. 'running' → 'run'"}
            </p>
            {lemmaPairs.length > 0 ? (
              <div style={scrollBox}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                  <thead>
                    <tr>
                      <th style={th}>Original</th>
                      <th style={{ ...th, width:32 }}></th>
                      <th style={th}>Base Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lemmaPairs.map((t,i) => (
                      <tr key={i}>
                        <td style={td(i%2)}><strong>{t.text}</strong></td>
                        <td style={{ ...td(i%2), color:"var(--ink-lt)" }}>→</td>
                        <td style={{ ...td(i%2), color:"var(--forest)", fontWeight:500 }}>{t.lemma}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ fontSize:13 }}>All words are already in base form.</p>
            )}
            <p className="muted" style={{ fontSize:12, marginTop:10 }}>
              {lemmaPairs.length} word{lemmaPairs.length!==1?"s":""} reduced to base form
            </p>
          </div>
        );

      case "morph":
        return (
          <div>
            <p className="muted" style={{ fontSize:12, marginBottom:14 }}>
              {isTamil ? "வார்த்தைகளின் இலக்கண அமைப்பை பகுப்பாய்வு செய்கிறது" :
               isSinhala ? "වචනවල ව්‍යාකරණ ව්‍යුහය විශ්ලේෂණය කරයි" :
               "Analyzes grammatical structure — tense, number, case, gender"}
            </p>
            <div style={scrollBox}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr>
                    {[
                      isTamil?"வார்த்தை":isSinhala?"වචනය":"Word",
                      isTamil?"மூல வடிவம்":isSinhala?"මූල ස්වරූපය":"Lemma",
                      isTamil?"இலக்கண வகை":isSinhala?"ව්‍යාකරණ":"POS",
                      isTamil?"உருபியல்":isSinhala?"රූපවිද්‍යා":"Features",
                    ].map(h => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(morphTokens.length>0 ? morphTokens : (nlp.token_details||[]).slice(0,50)).map((t,i) => (
                    <tr key={i}>
                      <td style={{ ...td(i%2), fontWeight:600 }}>{t.text}</td>
                      <td style={{ ...td(i%2), color:"var(--forest)" }}>{t.lemma}</td>
                      <td style={td(i%2)}>
                        <span className="pos-chip" style={{ fontSize:11, padding:"2px 8px" }}>
                          {t.tag||t.pos}
                        </span>
                      </td>
                      <td style={{ ...td(i%2), color:"var(--ink-lt)", fontSize:12 }}>
                        {t.morph ? translateMorph(t.morph, nlp.language) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "sentences":
        if (!nlp.sentences?.length) return <p className="muted">No sentences found.</p>;
        return (
          <div>
            <p className="muted" style={{ fontSize:12, marginBottom:14 }}>
              {nlp.sentence_count} sentence{nlp.sentence_count!==1?"s":""} detected
            </p>
            <div style={scrollBox}>
              {nlp.sentences.slice(0,20).map((s,i) => (
                <div key={i} style={{ padding:"10px 14px",
                  borderBottom:"1px solid var(--border)",
                  fontSize:13, lineHeight:1.6,
                  display:"flex", gap:12,
                  background: i%2 ? "var(--bg-lt)" : "transparent" }}>
                  <span style={{ color:"var(--ink-lt)", minWidth:20, flexShrink:0 }}>{i+1}.</span>
                  <span>{s}</span>
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
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
          <div style={{ flex:1 }}>
            <Link to="/" className="muted" style={{ fontSize:13, marginBottom:6, display:"inline-block" }}>← Dashboard</Link>
            <h1 className="page-title" style={{ wordBreak:"break-word" }}>{doc.filename}</h1>
            <div style={{ display:"flex", gap:10, marginTop:8, alignItems:"center", flexWrap:"wrap" }}>
              <span className="badge">{doc.file_type}</span>
              {doc.file_type==="pdf" && <PdfTypeBadge pdfType={doc.pdf_type} />}
              {doc.nlp?.language && <span className="badge">{doc.nlp.language_display||doc.nlp.language}</span>}
              <span className="muted">{new Date(doc.created_at).toLocaleDateString()}</span>
              {doc.nlp?.token_count && <span className="muted">{doc.nlp.token_count.toLocaleString()} tokens</span>}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexShrink:0 }}>
            <button className="btn btn-ghost btn-sm" type="button"
              onClick={() => exportDocument(id,"json",doc.filename?.split(".")[0]||"document")}>JSON</button>
            <button className="btn btn-ghost btn-sm" type="button"
              onClick={() => exportDocument(id,"csv",doc.filename?.split(".")[0]||"document")}>CSV</button>
          </div>
        </div>
      </div>

      <div className="card fade-up fade-up-1">
        {/* ── Top tabs ── */}
        <div className="tabs">
          {TABS.map(({ key, label }) => (
            <button key={key} className={`tab-btn${tab===key?" active":""}`}
              onClick={() => setTab(key)} type="button">{label}</button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab==="overview" && (
          <div style={{ padding:"8px 0" }}>
            <div style={{ background:"var(--mint)", border:"1px solid var(--border)",
              borderRadius:10, padding:"16px 20px", marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--forest)",
                textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>📋 Document Summary</div>
              <p style={{ margin:0, fontSize:15, lineHeight:1.7, color:"var(--ink)" }}>
                {doc.summary || "No summary available."}
              </p>
            </div>
            {doc.file_type==="pdf" && doc.pdf_type && (
              <div style={{ background:"#fff", border:"1px solid var(--border)",
                borderRadius:10, padding:"16px 20px", marginBottom:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--forest)",
                  textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>📄 PDF Type</div>
                <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                  <PdfTypeBadge pdfType={doc.pdf_type} />
                  <span style={{ fontSize:13, color:"var(--ink-lt)" }}>
                    {doc.pdf_type==="text_only" && "This PDF contains only selectable text."}
                    {doc.pdf_type==="text_image" && "This PDF contains text and images."}
                    {doc.pdf_type==="image_only" && "This is a scanned PDF. Full OCR applied."}
                  </span>
                </div>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",
              gap:12, marginBottom:20 }}>
              {[
                { label:"File Type",     value: doc.file_type?.toUpperCase() },
                { label:"Language",      value: doc.nlp?.language_display||doc.nlp?.language||"—" },
                { label:"Tokens",        value: doc.nlp?.token_count?.toLocaleString()||"—" },
                { label:"Unique Tokens", value: doc.nlp?.unique_tokens?.toLocaleString()||"—" },
                { label:"Sentences",     value: doc.nlp?.sentence_count?.toLocaleString()||"—" },
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
                  {doc.nlp.top_keywords.map((kw,i) => (
                    <span key={i} style={{ background:"var(--forest)", color:"#fff",
                      borderRadius:20, padding:"4px 14px", fontSize:13 }}>{kw}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="cleaned"  && <pre className="snippet">{doc.cleaned_text}</pre>}
        {tab==="raw"      && <pre className="snippet">{doc.raw_text}</pre>}
        {tab==="metadata" && <pre className="snippet">{JSON.stringify(doc.metadata,null,2)}</pre>}

        {/* ── NLP Tab with sidebar ── */}
        {tab==="nlp" && doc.nlp && (
          <div style={{ display:"flex", minHeight:500 }}>

            {/* Left sidebar */}
            <div style={{
              width:220, flexShrink:0,
              borderRight:"1px solid var(--border)",
              background:"var(--bg-lt)",
              padding:"12px 0",
            }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em",
                textTransform:"uppercase", color:"var(--ink-lt)",
                padding:"4px 18px 10px" }}>
                NLP Analysis
              </div>
              {NLP_SECTIONS.map(({ key, label, icon }) => (
                <button key={key} type="button" onClick={() => setNlpSec(key)}
                  style={{
                    display:"flex", alignItems:"center", gap:10,
                    width:"100%", padding:"11px 18px",
                    background: nlpSec===key ? "var(--card,#fff)" : "transparent",
                    border:"none",
                    borderLeft: nlpSec===key ? "3px solid var(--forest)" : "3px solid transparent",
                    borderRight:"none", borderTop:"none", borderBottom:"none",
                    color: nlpSec===key ? "var(--forest)" : "var(--ink-lt)",
                    fontWeight: nlpSec===key ? 600 : 400,
                    fontSize:13, cursor:"pointer",
                    textAlign:"left",
                    transition:"all 0.15s",
                  }}>
                  <span style={{ fontSize:15 }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            {/* Right content panel */}
            <div style={{ flex:1, padding:"24px 28px", overflowY:"auto", minWidth:0 }}>
              {/* Section header */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em",
                  textTransform:"uppercase", color:"var(--ink-lt)", marginBottom:6 }}>
                  NLP Analysis
                </div>
                <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:"var(--ink)",
                  display:"flex", alignItems:"center", gap:8 }}>
                  {NLP_SECTIONS.find(s=>s.key===nlpSec)?.icon}{" "}
                  {NLP_SECTIONS.find(s=>s.key===nlpSec)?.label}
                </h2>
              </div>

              {/* Section content */}
              {renderNlpSection()}
            </div>

          </div>
        )}

        {/* ── Charts ── */}
        {tab==="charts" && doc.nlp && (
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