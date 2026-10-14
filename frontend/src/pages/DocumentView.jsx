import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getDocument, exportDocument, updateDocumentMetadata } from "../api";

const PIE_COLORS = ["#1a3a2a", "#4a7c59", "#8fb89a", "#d4e8d0", "#2d5a3d", "#6aaa80", "#b0d8b8", "#386641"];

const NLP_SECTIONS = [
  {
    key: "tokens",
    label: { English: "Tokenization", Tamil: "சொல் பிரித்தல்", Sinhala: "ටෝකනීකරණය" },
    desc: {
      English: "Segments the text into individual normalized word tokens.",
      Tamil: "உரையை சீராக்கப்பட்ட தனித்தனி சொற்களாகப் பிரிக்கிறது.",
      Sinhala: "පෙළ ප්‍රමිතිගත තනි වචන ටෝකන බවට වෙන් කරයි.",
    },
  },
  {
    key: "sentences",
    label: { English: "Sentences", Tamil: "வாக்கியங்கள்", Sinhala: "වාක්‍ය" },
    desc: {
      English: "Multilingual sentence segmentation handling punctuation, abbreviations, and decimal numbers.",
      Tamil: "நிறுத்தற்குறிகள், சுருக்கங்கள் மற்றும் தசம எண்களைப் பாதுகாத்து வாக்கியங்களைப் பிரிக்கிறது.",
      Sinhala: "විරාම ලකුණු, කෙටි යෙදුම් සහ දශම සංඛ්‍යා නිවැරදිව කළමනාකරණය කරමින් වාක්‍ය වෙන් කරයි.",
    },
  },
  {
    key: "pos",
    label: { English: "Part-of-Speech (POS)", Tamil: "சொல் வகை (POS)", Sinhala: "පද වර්ග (POS)" },
    desc: {
      English: "Identifies grammatical roles of words: Nouns, Verbs, Adjectives, Adverbs, Pronouns, and Conjunctions.",
      Tamil: "சொற்களின் இலக்கண வகைகளை (பெயர்ச்சொல், வினைச்சொல், பெயரடை, வினையடை, பிரதிப்பெயர், இணைப்புச்சொல்) கண்டறிகிறது.",
      Sinhala: "වචනවල ව්‍යාකරණ භූමිකාව (නාම පද, ක්‍රියා පද, විශේෂණ, ක්‍රියා විශේෂණ, සර්වනාම, සම්බන්ධක පද) හඳුනා ගනී.",
    },
  },
  {
    key: "lemma",
    label: { English: "Lemmatization", Tamil: "வேர்ச்சொல்", Sinhala: "ලේමටීකරණය" },
    desc: {
      English: "Reduces inflected words to their base dictionary roots across English, Tamil, and Sinhala.",
      Tamil: "வார்த்தைகளை அவற்றின் அடிப்படை வேர்ச்சொல் வடிவத்திற்கு மாற்றுகிறது.",
      Sinhala: "වචනවල අර්ථය වෙනස් නොකර ඒවායේ මූලික ශබ්දකෝෂ ස්වරූපයට අඩු කරයි.",
    },
  },
  {
    key: "morph",
    label: { English: "Morphological Analysis", Tamil: "உருபியல் பகுப்பாய்வு", Sinhala: "රූප විද්‍යාත්මක විශ්ලේෂණය" },
    desc: {
      English: "Extracts grammatical features including grammatical Case, Number, Tense, and Person.",
      Tamil: "வேற்றுமை, எண், காலம் மற்றும் நபர் போன்ற உருபியல் கூறுகளை பகுப்பாய்வு செய்கிறது.",
      Sinhala: "විභක්ති, වචන, කාලය සහ පුරුෂ වැනි රූපවිද්‍යාත්මක ලක්ෂණ විග්‍රහ කරයි.",
    },
  },
  {
    key: "statistics",
    label: { English: "Corpus Statistics", Tamil: "புள்ளிவிவரங்கள்", Sinhala: "සංඛ්‍යාලේඛන" },
    desc: {
      English: "Detailed document metrics including character lengths, token density, vocabulary richness, and paragraph counts.",
      Tamil: "எழுத்துக்கள், சொற்கள், தனித்துவ சொற்கள் மற்றும் பந்திகள் பற்றிய முழுமையான புள்ளிவிவரங்கள்.",
      Sinhala: "අක්ෂර, ටෝකන, අනන්‍ය වචන සහ ඡේද පිළිබඳ සවිස්තරාත්මක සංඛ්‍යාලේඛන.",
    },
  },
  {
    key: "charts",
    label: { English: "Visual Charts", Tamil: "வரைபடங்கள்", Sinhala: "ප්‍රස්ථාර" },
    desc: {
      English: "Interactive visual distributions for grammatical POS categories.",
      Tamil: "சொல் வகைகளின் ஊடாடும் வரைபடங்கள்.",
      Sinhala: "පද වර්ග පිළිබඳ අන්තර්ක්‍රියාකාරී ප්‍රස්ථාර.",
    },
  },
];

const POS_INFO = {
  NOUN: { en: "Noun", ta: "பெயர்ச்சொல்", si: "නාම පදය", desc_en: "Names a person, place, object, or concept", desc_ta: "நபர், இடம், பொருள் அல்லது கருத்தைக் குறிக்கும் சொல்", desc_si: "පුද්ගලයෙකු, ස්ථානයක් හෝ වස්තුවක් නම් කරයි", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  PROPN: { en: "Proper Noun", ta: "சிறப்புப் பெயர்ச்சொல்", si: "විශේෂ නාම පදය", desc_en: "Specific named entity or proper name", desc_ta: "தனித்துவமான பெயர் அல்லது பெயர்ச்சொல்", desc_si: "විශේෂිත නාමයක්", color: "#2563eb", bg: "#dbeafe", border: "#93c5fd" },
  VERB: { en: "Verb", ta: "வினைச்சொல்", si: "ක්‍රියා පදය", desc_en: "Expresses an action, state, or event", desc_ta: "செயல் அல்லது நிலையைக் குறிக்கும் சொல்", desc_si: "ක්‍රියාවක් හෝ සිදුවීමක් දක්වයි", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  AUX: { en: "Auxiliary Verb", ta: "துணைவினை", si: "සහායක ක්‍රියාව", desc_en: "Helping or modal verb supporting main verb", desc_ta: "முதன்மை வினைக்கு உதவும் துணைவினை", desc_si: "උපකාරක ක්‍රියා පදය", color: "#0f766e", bg: "#f0fdfa", border: "#99f6e4" },
  ADJ: { en: "Adjective", ta: "பெயரடை", si: "නාම විශේෂණය", desc_en: "Describes or modifies a noun", desc_ta: "பெயர்ச்சொல்லின் பண்பை விவரிக்கும் சொல்", desc_si: "නාම පදයක ගුණාංග විස්තර කරයි", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  ADV: { en: "Adverb", ta: "வினையடை", si: "ක්‍රියා විශේෂණය", desc_en: "Modifies a verb, adjective, or clause", desc_ta: "வினைச்சொல் அல்லது பெயரடையின் தன்மையை விளக்கும் சொல்", desc_si: "ක්‍රියාවක හෝ විශේෂණයක ස්වභාවය දක්වයි", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
  PRON: { en: "Pronoun", ta: "பிரதிப்பெயர் (சுட்டுப்பெயர்)", si: "සර්වනාමය", desc_en: "Replaces a noun (he, she, it, they, you)", desc_ta: "பெயர்ச்சொல்லுக்கு மாற்றாகப் பயன்படும் சொல்", desc_si: "නාම පදයක් වෙනුවට යෙදෙන පදය", color: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff" },
  CONJ: { en: "Conjunction", ta: "இணைப்புச்சொல்", si: "සම්බන්ධක පදය", desc_en: "Connects words, phrases, or clauses", desc_ta: "சொற்கள் அல்லது வாக்கியங்களை இணைக்கும் சொல்", desc_si: "වචන හෝ වාක්‍ය එකිනෙක සම්බන්ධ කරයි", color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
  CCONJ: { en: "Coordinating Conjunction", ta: "இணைப்புச்சொல்", si: "සම්බන්ධක පදය", desc_en: "Connects equal grammatical elements (and, but, or)", desc_ta: "சமமான சொற்களை இணைக்கும் சொல்", desc_si: "සමාන ව්‍යාකරණ මට්ටමේ වචන සම්බන්ධ කරයි", color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
  SCONJ: { en: "Subordinating Conjunction", ta: "சார்ந்த இணைப்புச்சொல்", si: "උපකාරක සම්බන්ධකය", desc_en: "Introduces a dependent clause", desc_ta: "சார்ந்த வாக்கியங்களை இணைக்கும் சொல்", desc_si: "උප වාක්‍ය ඛණ්ඩයක් සම්බන්ධ කරයි", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  ADP: { en: "Postposition / Preposition", ta: "இடைச்சொல் (வேற்றுமை)", si: "නිපාතය / උපසර්ගය", desc_en: "Expresses spatial, temporal, or grammatical relation", desc_ta: "இடம், காலம் அல்லது வேற்றுமைத் தொடர்பைக் குறிக்கும் சொல்", desc_si: "ස්ථානය, කාලය හෝ සම්බන්ධතාවය දක්වන නිපාතය", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  POSTP: { en: "Postposition", ta: "இடைச்சொல்", si: "පසුනිපාතය", desc_en: "Placed after a word to indicate relationship", desc_ta: "சொல்லின் பின்வரும் இடைச்சொல்", desc_si: "පසුපසින් යෙදෙන නිපාතය", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  NUM: { en: "Numeral", ta: "எண்ணுப்பெயர் / எண்", si: "සංඛ්‍යා පදය", desc_en: "Number or quantity indicator", desc_ta: "எண் அல்லது அளவைக் குறிக்கும் சொல்", desc_si: "සංඛ්‍යාවක් හෝ ප්‍රමාණයක් දක්වයි", color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
  PUNCT: { en: "Punctuation", ta: "நிறுத்தற்குறி", si: "විරාම ලකුණු", desc_en: "Punctuation marks structuring text (. , ! ?)", desc_ta: "வாக்கிய அமைப்பைத் தெளிவுபடுத்தும் நிறுத்தற்குறி", desc_si: "පෙළ ව්‍යුහගත කරන විරාම ලකුණු", color: "#475569", bg: "#f8fafc", border: "#cbd5e1" },
  DET: { en: "Determiner", ta: "சுட்டுச்சொல்", si: "නිරූපකය", desc_en: "Determines noun reference (the, a, this, that)", desc_ta: "பெயர்ச்சொல்லைச் சுட்டிக்காட்டும் சொல்", desc_si: "නාම පදයක් නිරූපණය කරයි", color: "#a21caf", bg: "#fdf4ff", border: "#f5d0fe" },
  PART: { en: "Particle", ta: "இடைச்சொல் / அசை", si: "අංශු පදය", desc_en: "Grammatical function word or particle", desc_ta: "இலக்கண அசைச்சொல்", desc_si: "උපකාරක අංශු පදය", color: "#be185d", bg: "#fdf2f8", border: "#fbcfe8" },
  INTJ: { en: "Interjection", ta: "வியப்பிடைச்சொல்", si: "විස්මයාර්ථය", desc_en: "Expresses emotion or exclamation", desc_ta: "வியப்பு அல்லது உணர்ச்சியை வெளிப்படுத்தும் சொல்", desc_si: "විස්මය හෝ හැඟීමක් ප්‍රකාශ කරයි", color: "#be123c", bg: "#fff1f2", border: "#fecdd3" },
  SYM: { en: "Symbol", ta: "குறியீடு", si: "සංකේතය", desc_en: "Mathematical or special symbol", desc_ta: "கணித அல்லது சிறப்பு குறியீடு", desc_si: "විශේෂ සංකේත", color: "#334155", bg: "#f1f5f9", border: "#cbd5e1" },
  X: { en: "Other / Foreign", ta: "மற்றவை", si: "වෙනත්", desc_en: "Unclassified token or other category", desc_ta: "பிற வகைப்படுத்தப்படாத சொல்", desc_si: "වෙනත් වර්ගීකරණය නොකළ පද", color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db" },
};

const MORPH_LABELS = {
  English: {
    "Case=Nom": "Nominative", "Case=Acc": "Accusative", "Case=Dat": "Dative", "Case=Gen": "Genitive",
    "Case=Abl": "Ablative", "Case=Loc": "Locative", "Case=Ins": "Instrumental", "Case=Com": "Comitative",
    "Case=Ben": "Benefactive (For)",
    "Number=Sing": "Singular", "Number=Plur": "Plural", "Gender=Masc": "Masculine", "Gender=Fem": "Feminine",
    "Gender=Neut": "Neuter", "Tense=Past": "Past", "Tense=Pres": "Present", "Tense=Fut": "Future",
    "VerbForm=Inf": "Infinitive", "VerbForm=Fin": "Finite", "VerbForm=Part": "Participle",
    "Voice=Act": "Active", "Voice=Pass": "Passive", "Aspect=Perf": "Perfect", "Aspect=Prog": "Progressive",
    "Mood=Imp": "Imperative", "Mood=Pot": "Potential", "Mood=Des": "Desiderative",
    "Mood=Proh": "Prohibitive", "Mood=Opt": "Optative",
    "Person=1": "1st Person", "Person=2": "2nd Person", "Person=3": "3rd Person", "Polite=Yes": "Polite / Honorific",
    "Polarity=Neg": "Negative", "Definite=Ind": "Indefinite", "NumType=Card": "Cardinal",
    "PronType=Int": "Interrogative", "PronType=Dem": "Demonstrative", "PronType=Prs": "Personal",
    "Reflex=Yes": "Reflexive",
  },
  Tamil: {
    "Case=Nom": "எழுவாய்", "Case=Acc": "இரண்டாம் வேற்றுமை (ஐ)", "Case=Dat": "நான்காம் வேற்றுமை (கு)",
    "Case=Gen": "ஆறாம் வேற்றுமை (இன்)", "Case=Abl": "ஐந்தாம் வேற்றுமை (இலிருந்து)", "Case=Loc": "ஏழாம் வேற்றுமை (இல்)",
    "Case=Ins": "மூன்றாம் வேற்றுமை (ஆல்)", "Case=Com": "உடன் வேற்றுமை",
    "Case=Ben": "நான்காம் வேற்றுமை (பொருட்டு/க்காக)",
    "Number=Sing": "ஒருமை", "Number=Plur": "பன்மை",
    "Tense=Past": "இறந்தகாலம்", "Tense=Pres": "நிகழ்காலம்", "Tense=Fut": "எதிர்காலம்",
    "VerbForm=Inf": "தொழிற்பெயர்", "VerbForm=Fin": "முற்று வினை", "VerbForm=Part": "பெயரெச்சம்/வினையெச்சம்",
    "Voice=Act": "செய்வினை", "Voice=Pass": "செயப்பாட்டுவினை",
    "Mood=Imp": "ஏவல் வினை (முன்னிலை)", "Mood=Pot": "சாத்திய முறைமை", "Mood=Des": "விழைவு முறைமை",
    "Mood=Proh": "விலக்கல் முறைமை (கூடாது)", "Mood=Opt": "வியங்கோள் வினை",
    "Person=1": "தன்மை", "Person=2": "முன்னிலை", "Person=3": "படர்க்கை", "Polite=Yes": "மரியாதை",
    "Polarity=Neg": "எதிர்மறை",
  },
  Sinhala: {
    "Case=Nom": "ප්‍රථමා විභක්තිය", "Case=Acc": "කර්ම විභක්තිය", "Case=Dat": "සම්ප්‍රදාන විභක්තිය",
    "Case=Gen": "සම්බන්ධ විභක්තිය", "Case=Abl": "අවධි විභක්තිය", "Case=Loc": "ආධාර විභක්තිය",
    "Case=Ins": "කරණ විභක්තිය",
    "Case=Ben": "හිතාර්ථ විභක්තිය",
    "Number=Sing": "ඒකවචන", "Number=Plur": "බහුවචන",
    "Tense=Past": "අතීත කාලය", "Tense=Pres": "වර්තමාන කාලය", "Tense=Fut": "අනාගත කාලය",
    "VerbForm=Inf": "අනියම් ක්‍රියාව", "VerbForm=Fin": "සීමිත ක්‍රියාව", "VerbForm=Part": "කෘදන්තය",
    "Voice=Act": "කර්තෘ කාරක", "Voice=Pass": "කර්ම කාරක",
    "Mood=Imp": "විධානාර්ථ ක්‍රියාව", "Mood=Pot": "හැකියාව", "Mood=Des": "අපේක්ෂිතය",
    "Mood=Proh": "තහනම් ආකාරය", "Mood=Opt": "ආශිර්වාදාත්මක",
    "Person=1": "උත්තම පුරුෂ", "Person=2": "මධ්‍යම පුරුෂ", "Person=3": "ප්‍රථම පුරුෂ", "Polite=Yes": "ගෞරවාර්ථ",
    "Polarity=Neg": "සෘණාත්මක",
  },
};

const METADATA_FIELDS = [
  { key: "source", label: ["Source", "மூலம் (Source)", "මූලාශ්‍රය (Source)"], required: true, placeholder: "e.g. Daily News, Wikipedia, Research Paper" },
  { key: "domain", label: ["Domain", "பிரிவு (Domain)", "ක්ෂේත්‍රය (Domain)"], required: true, placeholder: "e.g. General, News, Technology, Legal, Sports" },
  { key: "license", label: ["License", "உரிமம் (License)", "බලපත්‍රය (License)"], required: true, placeholder: "e.g. CC-BY-4.0, MIT, Public Domain, All Rights Reserved" },
  { key: "category", label: ["Category", "அணுகல் வகை (Category)", "ප්‍රවේශ කාණ්ඩය (Category)"], options: ["open", "research", "restricted"] },
  { key: "author", label: ["Author", "ஆசிரியர் (Author)", "කර්තෘ (Author)"], placeholder: "e.g. Author or Organization name" },
  { key: "publication_date", label: ["Publication Date", "வெளியீட்டு தேதி (Publication Date)", "ප්‍රකාශන දිනය (Publication Date)"], placeholder: "YYYY-MM-DD or text" },
];
const STANDARD_METADATA_KEYS = METADATA_FIELDS.map((f) => f.key);

const scrollBox = {
  maxHeight: 300, overflowY: "auto",
  border: "1px solid var(--border)", borderRadius: 8, background: "var(--paper)",
};
const th = {
  textAlign: "left", padding: "9px 12px",
  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
  textTransform: "uppercase", color: "var(--ink-lt)",
  background: "var(--bg-lt)", borderBottom: "2px solid var(--border)",
};
const tdStyle = (zebra) => ({
  padding: "8px 12px", borderBottom: "1px solid var(--border)",
  background: zebra ? "var(--bg-lt)" : "transparent",
});
const inputStyle = {
  width: "100%", padding: "8px 12px", borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--paper)", color: "var(--ink)",
};
const panelStyle = {
  background: "var(--bg-lt)", borderRadius: 10, padding: 18, border: "1px solid var(--border)",
};
const sectionTitleStyle = {
  fontSize: 12, fontWeight: 700, color: "var(--forest)",
  textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
};

const makeTr = (lang) => (en, ta, si) => (lang === "Tamil" ? ta : lang === "Sinhala" ? si : en);
const pick = (obj, lang) => (obj && (obj[lang] || obj.English)) || "";
const tokenText = (tk) => tk.text || tk.token || "";
const formatDate = (value) => new Date(value).toLocaleDateString();
const stringifyValue = (v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? ""));

const getErrorMessage = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  return typeof detail === "string" ? detail : JSON.stringify(detail);
};

const getPosInfo = (tag) => POS_INFO[String(tag || "").toUpperCase()] || POS_INFO.X;
const getPosLabel = (tag, lang) => {
  const info = getPosInfo(tag);
  return lang === "Tamil" ? info.ta : lang === "Sinhala" ? info.si : info.en;
};
const getPosDesc = (tag, lang) => {
  const info = getPosInfo(tag);
  return lang === "Tamil" ? info.desc_ta : lang === "Sinhala" ? info.desc_si : info.desc_en;
};

const translateMorph = (morph, lang) => {
  if (!morph) return "";
  const labels = MORPH_LABELS[lang] || MORPH_LABELS.English;
  return morph.split("|").map((f) => labels[f] || MORPH_LABELS.English[f] || f).join(" | ");
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
      color: c.color, borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 600,
    }}>
      {c.icon} {c.label}
    </span>
  );
}

function SectionDesc({ desc }) {
  if (!desc) return null;
  return (
    <div style={{
      background: "var(--bg-lt)", border: "1px solid var(--border)", borderRadius: 8,
      padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--ink-lt)",
      lineHeight: 1.6, display: "flex", alignItems: "flex-start", gap: 10,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>ℹ️</span>
      {desc}
    </div>
  );
}

function StatGrid({ min = 140, gap = 12, children, style }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap, ...style }}>
      {children}
    </div>
  );
}

function StatTile({ label, value, centered = false, size = 22 }) {
  return (
    <div style={{
      background: "var(--bg-lt)", borderRadius: 8, padding: "12px 16px",
      textAlign: centered ? "center" : "left", border: centered ? "none" : "1px solid var(--border)",
    }}>
      <div style={{ fontSize: size, fontWeight: 700, color: "var(--forest)" }}>{value ?? "—"}</div>
      <div style={{ fontSize: 11, color: "var(--ink-lt)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ProgressBar({ percent, color = "var(--forest)", height = 8, width = "100%" }) {
  return (
    <div style={{ width, height, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ width: `${percent}%`, height: "100%", background: color, borderRadius: 99 }} />
    </div>
  );
}

function ScrollTable({ headers, rows, emptyText, numbered = true }) {
  const columnCount = headers.length + (numbered ? 1 : 0);
  return (
    <div style={scrollBox}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {numbered && <th style={{ ...th, width: 45 }}>#</th>}
            {headers.map((h, i) => <th key={i} style={{ ...th, width: h.width }}>{h.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {numbered && <td style={{ ...tdStyle(i % 2), color: "var(--ink-lt)" }}>{i + 1}</td>}
              {cells.map((cell, j) => <td key={j} style={tdStyle(i % 2)}>{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columnCount} style={{ padding: 24, textAlign: "center", color: "var(--ink-lt)" }}>
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={panelStyle}>
      <h4 style={{ color: "var(--forest)", margin: "0 0 14px 0", fontSize: 14 }}>{title}</h4>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function TokensSection({ nlp, tr, desc }) {
  const rows = (nlp.token_details || []).slice(0, 250).map((tk) => [
    <strong>{tokenText(tk)}</strong>,
  ]);
  return (
    <div>
      <SectionDesc desc={desc} />
      <ScrollTable
        headers={[{ label: tr("Token", "சொல்", "ටෝකනය") }]}
        rows={rows}
        emptyText={tr("No tokens found.", "சொற்கள் எதுவும் இல்லை.", "ටෝකන හමු නොවීය.")}
      />
    </div>
  );
}

function SentencesSection({ nlp, desc }) {
  return (
    <div>
      <SectionDesc desc={desc} />
      <div style={scrollBox}>
        {(nlp.sentences || []).map((s, i) => (
          <div key={i} style={{
            padding: "10px 14px", borderBottom: "1px solid var(--border)",
            fontSize: 13, lineHeight: 1.6, display: "flex", gap: 12,
            background: i % 2 ? "var(--bg-lt)" : "transparent",
          }}>
            <span style={{ color: "var(--ink-lt)", minWidth: 24, flexShrink: 0, fontWeight: 600 }}>{i + 1}.</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PosSection({ nlp, lang, tr, desc }) {
  const [filter, setFilter] = useState(null);
  const [query, setQuery] = useState("");

  const distribution = Object.entries(nlp.pos_distribution || {}).sort((a, b) => b[1] - a[1]);
  const total = distribution.reduce((sum, [, count]) => sum + (typeof count === "number" ? count : 0), 0) || 1;
  const needle = query.trim().toLowerCase();

  const tokens = (nlp.token_details || []).filter((tk) => {
    const pos = (tk.pos || "").toUpperCase();
    if (filter && pos !== filter.toUpperCase()) return false;
    return !needle || tokenText(tk).toLowerCase().includes(needle) || pos.toLowerCase().includes(needle);
  });

  const rows = tokens.slice(0, 200).map((tk) => {
    const info = getPosInfo(tk.pos);
    return [
      <strong>{tokenText(tk)}</strong>,
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 8px", borderRadius: 6,
        background: info.bg, color: info.color, border: `1px solid ${info.border}`, fontSize: 12, fontWeight: 600,
      }}>
        <span>{getPosLabel(tk.pos, lang)}</span>
        <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 700 }}>({tk.pos})</span>
      </span>,
    ];
  });

  return (
    <div>
      <SectionDesc desc={desc} />

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10, marginBottom: 16,
        background: "var(--bg-lt)", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)",
      }}>
        <div style={{ fontSize: 13, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>
            {tr("Document Language Grammatical POS:", "ஆவண மொழி இலக்கண வகைப்பாடு:", "ලේඛන භාෂා ව්‍යාකරණ වර්ගීකරණය:")}
          </span>
          <span className="badge" style={{ background: "var(--mint)", color: "var(--forest)", fontWeight: 700 }}>
            {nlp.language_display || nlp.language || lang}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-lt)" }}>
          {tr("Total POS Categories", "மொத்த வகைகள்", "මුළු කාණ්ඩ")}: {distribution.length}
        </div>
      </div>

      <StatGrid min={200} gap={10} style={{ marginBottom: 20 }}>
        {distribution.map(([pos, count]) => {
          const info = getPosInfo(pos);
          const selected = filter === pos;
          return (
            <div
              key={pos}
              onClick={() => setFilter(selected ? null : pos)}
              title={getPosDesc(pos, lang)}
              style={{
                cursor: "pointer", padding: "12px 14px", borderRadius: 8,
                border: selected ? `2px solid ${info.color}` : `1px solid ${info.border}`,
                background: selected ? info.bg : "var(--paper)",
                boxShadow: selected ? `0 2px 8px ${info.border}` : "none",
                transition: "all 0.15s ease", display: "flex", flexDirection: "column", gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                    background: info.bg, color: info.color, border: `1px solid ${info.border}`,
                  }}>
                    {pos}
                  </span>
                  <strong style={{ fontSize: 13, color: "var(--ink)" }}>{getPosLabel(pos, lang)}</strong>
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: info.color,
                  background: info.bg, padding: "2px 8px", borderRadius: 12,
                }}>
                  {count}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                <span style={{
                  fontSize: 11, color: "var(--ink-lt)", whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140,
                }}>
                  {getPosDesc(pos, lang)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-lt)" }}>
                  {Math.round((count / total) * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </StatGrid>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              {tr("Words by Part-of-Speech", "சொற்கள் வாரியான இலக்கண விபரம்", "වචන අනුව ව්‍යාකරණ විස්තරය")}
            </h4>
            {filter && (
              <button
                type="button"
                onClick={() => setFilter(null)}
                style={{
                  background: "none", border: "1px solid var(--border)", borderRadius: 12,
                  padding: "2px 8px", fontSize: 11, color: "var(--ink-lt)", cursor: "pointer",
                }}
              >
                ✕ {tr("Clear Filter", "வடிப்பை நீக்கு", "පෙරහන ඉවත් කරන්න")} ({filter})
              </button>
            )}
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("Search word or POS...", "சொல்லைத் தேடுங்கள்...", "වචනයක් සොයන්න...")}
            style={{
              padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
              fontSize: 12, background: "var(--paper)", color: "var(--ink)", width: 220,
            }}
          />
        </div>

        <ScrollTable
          headers={[
            { label: tr("Token", "சொல்", "වචනය (ටෝකනය)") },
            { label: tr("Part-of-Speech", "இலக்கண வகை (POS)", "පද වර්ගය (POS)"), width: 220 },
          ]}
          rows={rows}
          emptyText={tr("No matching tokens found.", "பொருந்தும் சொற்கள் எதுவும் இல்லை.", "ගැලපෙන වචන හමු නොවීය.")}
        />
      </div>
    </div>
  );
}

function LemmaSection({ nlp, tr, desc }) {
  const seen = new Set();
  const pairs = [];
  for (const tk of nlp.token_details || []) {
    const text = tokenText(tk);
    if (!tk.lemma || text.toLowerCase() === tk.lemma.toLowerCase()) continue;
    const key = `${text}→${tk.lemma}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(tk);
    if (pairs.length >= 100) break;
  }

  return (
    <div>
      <SectionDesc desc={desc} />
      {pairs.length > 0 ? (
        <ScrollTable
          numbered={false}
          headers={[
            { label: tr("Original", "அசல் சொல்", "මුල් වචනය") },
            { label: "", width: 32 },
            { label: tr("Base Form (Lemma)", "வேர்ச்சொல்", "මූල ස්වරූපය") },
            { label: tr("Language", "மொழி", "භාෂාව"), width: 80 },
          ]}
          rows={pairs.map((tk) => [
            <strong>{tokenText(tk)}</strong>,
            <span style={{ color: "var(--ink-lt)" }}>→</span>,
            <span style={{ color: "var(--forest)", fontWeight: 600 }}>{tk.lemma}</span>,
            <span className="badge" style={{ fontSize: 11 }}>{tk.language || "en"}</span>,
          ])}
        />
      ) : (
        <p className="muted" style={{ fontSize: 13 }}>
          {tr(
            "All words are already in base form.",
            "அனைத்து வார்த்தைகளும் ஏற்கனவே அவற்றின் வேர்ச்சொல் வடிவத்தில் உள்ளன.",
            "සියලු වචන දැනටමත් මූල ස්වරූපයේ ඇත."
          )}
        </p>
      )}
    </div>
  );
}

function MorphSection({ nlp, lang, tr, desc }) {
  const rows = (nlp.token_details || [])
    .filter((tk) => tk.morph)
    .slice(0, 50)
    .map((tk) => [
      <strong>{tokenText(tk)}</strong>,
      <span style={{ fontSize: 12 }}>{translateMorph(tk.morph, lang)}</span>,
    ]);

  return (
    <div>
      <SectionDesc desc={desc} />
      <ScrollTable
        headers={[
          { label: tr("Word", "வார்த்தை", "වචනය"), width: 220 },
          { label: tr("Morphological Features", "இலக்கண உருபியல் கூறுகள்", "රූපවිද්‍යාත්මක ලක්ෂණ") },
        ]}
        rows={rows}
        emptyText={tr("No morphological features found.", "உருபியல் தரவு எதுவும் கிடைக்கவில்லை.", "රූපවිද්‍යාත්මක දත්ත හමු නොවීය.")}
      />
    </div>
  );
}

function StatisticsSection({ nlp, tr, desc }) {
  const stats = nlp.statistics || {};
  const tiles = [
    [tr("Total Characters", "மொத்த எழுத்துக்கள்", "මුළු අක්ෂර"), stats.characters],
    [tr("Characters (No Space)", "இடைவெளியற்ற எழுத்துக்கள்", "හිස්තැන් රහිත අක්ෂර"), stats.characters_without_spaces],
    [tr("Total Tokens", "மொத்த சொற்கள்", "මුළු ටෝකන"), stats.tokens],
    [tr("Unique Tokens", "தனித்துவ சொற்கள்", "අනන්‍ය වචන"), stats.unique_tokens],
    [tr("Sentence Count", "வாக்கியங்கள்", "වාක්‍ය ගණන"), stats.sentences],
    [tr("Paragraph Count", "பந்திகள்", "ඡේද ගණන"), stats.paragraphs],
  ];

  return (
    <div>
      <SectionDesc desc={desc} />
      <StatGrid min={180} gap={14}>
        {tiles.map(([label, value]) => (
          <StatTile key={label} label={label} value={value?.toLocaleString()} size={24} />
        ))}
      </StatGrid>
    </div>
  );
}

const LANG_COLORS = { English: "#3b82f6", Tamil: "#f97316", Sinhala: "#10b981", Other: "#8b5cf6", en: "#3b82f6", ta: "#f97316", si: "#10b981" };
const LANG_NAMES = { en: "English", ta: "Tamil", si: "Sinhala" };

const countBy = (items, keyFn) => {
  const out = {};
  items.forEach((item) => {
    const key = keyFn(item);
    if (key !== undefined && key !== null && key !== "") out[key] = (out[key] || 0) + 1;
  });
  return out;
};

function ChartsSection({ nlp, lang, tr, desc }) {
  const tokens = nlp.token_details || [];
  const sentences = (nlp.sentences || []).map((s) => (typeof s === "string" ? s : s?.text || s?.sentence || ""));

  const posAll = Object.entries(nlp.pos_distribution || {})
    .map(([pos, count]) => ({
      name: getPosLabel(pos, lang),
      label: `${getPosLabel(pos, lang)} (${pos})`,
      count,
      color: getPosInfo(pos).color,
    }))
    .sort((a, b) => b.count - a.count);
  const posChartData = posAll.slice(0, 8);
  const posTotal = posAll.reduce((sum, p) => sum + p.count, 0) || 1;
  const posPieData = posAll.slice(0, 6).map((p) => ({ name: p.name, value: Math.round((p.count / posTotal) * 1000) / 10, color: p.color }));

  const topWordsData = (nlp.top_words || []).slice(0, 10).map((item) => {
    if (Array.isArray(item)) return { word: String(item[0]), count: item[1] };
    return { word: String(item.word ?? item.text ?? ""), count: item.count ?? item.frequency ?? 0 };
  });

  const langDist = nlp.statistics?.language_distribution;
  const langPieData = langDist && Object.keys(langDist).length
    ? Object.entries(langDist).map(([name, value]) => ({ name, value }))
    : Object.entries(countBy(tokens, (tk) => LANG_NAMES[tk.language] || tk.language)).map(([name, value]) => ({ name, value }));

  const buckets = [["1-5", 1, 5], ["6-10", 6, 10], ["11-15", 11, 15], ["16-20", 16, 20], ["21-30", 21, 30], ["31+", 31, Infinity]];
  const sentenceLenData = buckets.map(([range, lo, hi]) => ({
    range,
    count: sentences.filter((s) => {
      const n = s.trim().split(/\s+/).filter(Boolean).length;
      return n >= lo && n <= hi;
    }).length,
  }));

  const tokenLenData = Array.from({ length: 10 }, (_, i) => ({ length: i === 9 ? "10+" : String(i + 1), count: 0 }));
  tokens.forEach((tk) => {
    const len = Array.from(tokenText(tk)).length;
    if (len > 0) tokenLenData[Math.min(len, 10) - 1].count += 1;
  });

  const stopCount = tokens.filter((tk) => tk.is_stop).length;
  const stopData = [
    { name: tr("Content Words", "உள்ளடக்க சொற்கள்", "අන්තර්ගත වචන"), value: tokens.length - stopCount, color: "#4a7c59" },
    { name: tr("Stop Words", "நிறுத்தச் சொற்கள்", "නවත්වන වචන"), value: stopCount, color: "#cbd5e1" },
  ].filter((d) => d.value > 0);

  const lemmaChanged = tokens.filter((tk) => tk.lemma && tokenText(tk) && tk.lemma.toLowerCase() !== tokenText(tk).toLowerCase()).length;
  const lemmaData = [
    { name: tr("Reduced to Root", "வேர்ச்சொல்லாக மாற்றப்பட்டவை", "මූලයට අඩු කළ"), value: lemmaChanged, color: "#f97316" },
    { name: tr("Already Base Form", "ஏற்கனவே வேர்ச்சொல்", "දැනටමත් මූල ස්වරූපය"), value: tokens.length - lemmaChanged, color: "#8fb89a" },
  ].filter((d) => d.value > 0);

  const morphCounts = {};
  tokens.forEach((tk) => {
    if (!tk.morph) return;
    String(tk.morph).split("|").forEach((f) => { if (f) morphCounts[f] = (morphCounts[f] || 0) + 1; });
  });
  const morphData = Object.entries(morphCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([feature, count]) => ({ feature: translateMorph(feature, lang), count }));

  const lexicalVariety = tokens.length
    ? [
        { name: tr("Unique Tokens", "தனித்துவ சொற்கள்", "අනන්‍ය ටෝකන"), value: nlp.unique_tokens || 0, color: "#1a3a2a" },
        { name: tr("Repeated Tokens", "மீண்டும் வரும் சொற்கள்", "නැවත යෙදුණු ටෝකන"), value: Math.max((nlp.token_count || tokens.length) - (nlp.unique_tokens || 0), 0), color: "#b0d8b8" },
      ].filter((d) => d.value > 0)
    : [];

  const pieLabel = (entry) => `${entry.name} (${entry.value}%)`;
  const countPieLabel = (entry) => `${entry.name}`;
  const palette = (entry, i) => entry.color || LANG_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length];

  const renderPie = (data, label, inner = 0) => (
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={inner} outerRadius={80} label={label}>
        {data.map((entry, i) => <Cell key={entry.name} fill={palette(entry, i)} />)}
      </Pie>
      <Tooltip /><Legend />
    </PieChart>
  );

  const cards = [
    posChartData.length > 0 && (
      <ChartCard key="pos" title={tr("Part-of-Speech Distribution", "சொல் வகைப் பகிர்வு (POS)", "පද වර්ග බෙදාහැරීම (POS)")}>
        <BarChart data={posChartData}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={45} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value, name, item) => [value, item?.payload?.label || name]} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {posChartData.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
          </Bar>
        </BarChart>
      </ChartCard>
    ),
    posPieData.length > 0 && (
      <ChartCard key="pospie" title={tr("POS Share (%)", "சொல் வகை விகிதம் (%)", "පද වර්ග අනුපාතය (%)")}>
        {renderPie(posPieData, pieLabel, 45)}
      </ChartCard>
    ),
    topWordsData.length > 0 && (
      <ChartCard key="topwords" title={tr("Top 10 Most Frequent Words", "அதிகம் பயன்படுத்தப்பட்ட 10 சொற்கள்", "වඩාත්ම භාවිත වචන 10")}>
        <BarChart data={topWordsData} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="word" tick={{ fontSize: 11 }} width={90} />
          <Tooltip />
          <Bar dataKey="count" fill="#2d5a3d" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>
    ),
    langPieData.length > 0 && (
      <ChartCard key="lang" title={tr("Language Distribution", "மொழிப் பகிர்வு", "භාෂා බෙදාහැරීම")}>
        {renderPie(langPieData, countPieLabel)}
      </ChartCard>
    ),
    sentences.length > 0 && (
      <ChartCard key="sentlen" title={tr("Sentence Length (words)", "வாக்கிய நீளம் (சொற்கள்)", "වාක්‍ය දිග (වචන)")}>
        <BarChart data={sentenceLenData}>
          <XAxis dataKey="range" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
    ),
    tokens.length > 0 && (
      <ChartCard key="toklen" title={tr("Token Length (characters)", "சொல் நீளம் (எழுத்துக்கள்)", "ටෝකන දිග (අක්ෂර)")}>
        <BarChart data={tokenLenData}>
          <XAxis dataKey="length" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
    ),
    stopData.length > 1 && (
      <ChartCard key="stop" title={tr("Stop Words vs Content Words", "நிறுத்தச் சொற்கள் vs உள்ளடக்க சொற்கள்", "නවත්වන වචන vs අන්තර්ගත වචන")}>
        {renderPie(stopData, countPieLabel, 45)}
      </ChartCard>
    ),
    lemmaData.length > 1 && (
      <ChartCard key="lemma" title={tr("Lemmatization Impact", "வேர்ச்சொல் தாக்கம்", "ලේමටීකරණ බලපෑම")}>
        {renderPie(lemmaData, countPieLabel, 45)}
      </ChartCard>
    ),
    lexicalVariety.length > 1 && (
      <ChartCard key="variety" title={tr("Lexical Variety", "சொல் வளம்", "වචන විවිධත්වය")}>
        {renderPie(lexicalVariety, countPieLabel, 45)}
      </ChartCard>
    ),
    morphData.length > 0 && (
      <ChartCard key="morph" title={tr("Top Morphological Features", "முக்கிய உருபியல் கூறுகள்", "ප්‍රධාන රූපවිද්‍යාත්මක ලක්ෂණ")}>
        <BarChart data={morphData} layout="vertical" margin={{ left: 20 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="feature" tick={{ fontSize: 10 }} width={110} />
          <Tooltip />
          <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>
    ),
  ].filter(Boolean);

  return (
    <div>
      <SectionDesc desc={desc} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {cards}
      </div>
    </div>
  );
}


const SECTION_COMPONENTS = {
  tokens: TokensSection,
  sentences: SentencesSection,
  pos: PosSection,
  lemma: LemmaSection,
  morph: MorphSection,
  statistics: StatisticsSection,
  charts: ChartsSection,
};

function NlpTab({ nlp, lang, tr }) {
  const [sectionKey, setSectionKey] = useState("tokens");
  const section = NLP_SECTIONS.find((s) => s.key === sectionKey);
  const Section = SECTION_COMPONENTS[sectionKey];

  return (
    <div style={{ display: "flex", minHeight: 520 }}>
      <div style={{
        width: 220, flexShrink: 0, borderRight: "1px solid var(--border)",
        background: "var(--bg-lt)", padding: "12px 0",
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--ink-lt)", padding: "4px 18px 10px",
        }}>
          {tr("NLP Analysis", "NLP பகுப்பாய்வு", "NLP විශ්ලේෂණය")}
        </div>
        {NLP_SECTIONS.map(({ key, label }) => {
          const active = sectionKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSectionKey(key)}
              style={{
                display: "block", width: "100%", padding: "10px 18px",
                background: active ? "var(--card,#fff)" : "transparent",
                border: "none",
                borderLeft: active ? "3px solid var(--forest)" : "3px solid transparent",
                color: active ? "var(--forest)" : "var(--ink-lt)",
                fontWeight: active ? 600 : 400,
                fontSize: 13, cursor: "pointer", textAlign: "left",
              }}
            >
              {pick(label, lang)}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto", minWidth: 0 }}>
        <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
          {pick(section?.label, lang)}
        </h2>
        <Section key={sectionKey} nlp={nlp} lang={lang} tr={tr} desc={pick(section?.desc, lang)} />
      </div>
    </div>
  );
}

function OverviewTab({ doc, nlp, tr }) {
  const tiles = [
    [tr("File Type", "வகை", "වර්ගය"), doc.file_type?.toUpperCase()],
    [tr("Primary Language", "மொழி", "භාෂාව"), nlp.language],
    [tr("Tokens", "சொற்கள்", "ටෝකන"), nlp.token_count?.toLocaleString()],
    [tr("Unique Tokens", "தனித்துவ சொற்கள்", "අනන්‍ය"), nlp.unique_tokens?.toLocaleString()],
    [tr("Sentences", "வாக்கியங்கள்", "වාක්‍ය"), nlp.sentence_count?.toLocaleString()],
    [tr("Uploaded", "பதிவேற்றம்", "උඩුගත කළ දිනය"), formatDate(doc.created_at)],
  ];

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{
        background: "var(--mint)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "16px 20px", marginBottom: 20,
      }}>
        <div style={{ ...sectionTitleStyle, marginBottom: 8 }}>
          📋 {tr("Document Summary", "ஆவண சுருக்கம்", "ලේඛන සාරාංශය")}
        </div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "var(--ink)" }}>
          {doc.summary || "No summary available."}
        </p>
      </div>

      <StatGrid style={{ marginBottom: 20 }}>
        {tiles.map(([label, value]) => (
          <StatTile key={label} centered size={18} label={label} value={value || "—"} />
        ))}
      </StatGrid>

      {nlp.top_keywords?.length > 0 && (
        <div>
          <div style={sectionTitleStyle}>
            🔑 {tr("Top Keywords", "முக்கிய குறிச்சொற்கள்", "ප්‍රධාන මූල පද")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {nlp.top_keywords.map((kw, i) => (
              <span key={i} style={{
                background: "var(--forest)", color: "#fff",
                borderRadius: 20, padding: "4px 14px", fontSize: 13,
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaCard({ label, children, breakAll = false }) {
  return (
    <div style={{
      background: "var(--bg-lt)", borderRadius: 8, padding: "14px 16px", border: "1px solid var(--border)",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.06em", color: "var(--ink-lt)", marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", wordBreak: breakAll ? "break-all" : "normal" }}>
        {children}
      </div>
    </div>
  );
}

function MetadataTab({ docId, metadata, tr, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [customFields, setCustomFields] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const current = metadata || {};
  const extras = Object.entries(current).filter(([key]) => !STANDARD_METADATA_KEYS.includes(key));
  const hasMetadata = Object.keys(current).length > 0;

  const startEdit = () => {
    setForm(Object.fromEntries(
      METADATA_FIELDS.map((f) => [f.key, current[f.key] || (f.options ? f.options[0] : "")])
    ));
    setCustomFields(extras.map(([key, value]) => ({ key, value: stringifyValue(value) })));
    setMessage(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setMessage(null);
  };

  const updateCustomField = (index, field, value) => {
    setCustomFields((fields) => fields.map((f, i) => (i === index ? { ...f, [field]: value } : f)));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const payload = { ...form };
    customFields.forEach(({ key, value }) => {
      const trimmed = key.trim();
      if (trimmed && !STANDARD_METADATA_KEYS.includes(trimmed)) payload[trimmed] = value;
    });

    try {
      const res = await updateDocumentMetadata(docId, payload);
      onSaved(res.metadata || payload);
      setMessage({
        type: "success",
        text: tr("Metadata updated successfully.", "மெட்டாடேட்டா வெற்றிகரமாக புதுப்பிக்கப்பட்டது.", "පාරදත්ත සාර්ථකව යාවත්කාලීන කරන ලදී."),
      });
      setEditing(false);
    } catch (err) {
      setMessage({
        type: "error",
        text: getErrorMessage(
          err,
          tr("Failed to update metadata.", "மெட்டாடேட்டாவை புதுப்பிப்பதில் தோல்வி.", "පාරදත්ත යාවත්කාලීන කිරීම අසාර්ථක විය.")
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
            {tr("Document Metadata", "ஆவண மெட்டாடேட்டா", "ලේඛන පාරදත්ත")}
          </h3>
          <p className="muted" style={{ margin: "3px 0 0", fontSize: 13 }}>
            {tr(
              "Manage document provenance, licensing, domain, and custom metadata.",
              "ஆவணத்தின் மூல உரிமை, வகை மற்றும் விவரங்களை நிர்வகிக்கவும்.",
              "ලේඛනයේ මූලාශ්‍රය, බලපත්‍රය සහ අමතර තොරතුරු කළමනාකරණය කරන්න."
            )}
          </p>
        </div>
        {!editing && (
          <button type="button" className="btn btn-primary btn-sm" onClick={startEdit}>
            {tr("Edit Metadata", "மெட்டாடேட்டாவைத் திருத்து", "පාරදත්ත සංස්කරණය කරන්න")}
          </button>
        )}
      </div>

      {message && (
        <div
          className={message.type === "success" ? "alert-success" : "alert-error"}
          style={{
            marginBottom: 16, padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: message.type === "success" ? "#dcfce7" : "#fee2e2",
            color: message.type === "success" ? "#15803d" : "#b91c1c",
            border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`,
          }}
        >
          {message.text}
        </div>
      )}

      {!editing ? (
        <div>
          {hasMetadata ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
              {METADATA_FIELDS.map((f) => (
                <MetaCard key={f.key} label={tr(...f.label)}>
                  {current[f.key] || <span className="muted" style={{ fontWeight: 400 }}>—</span>}
                </MetaCard>
              ))}
              {extras.map(([key, value]) => (
                <MetaCard key={key} label={key} breakAll>{stringifyValue(value)}</MetaCard>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "32px 16px", background: "var(--bg-lt)", borderRadius: 8, marginBottom: 20 }}>
              <p className="muted" style={{ margin: "0 0 12px 0" }}>
                {tr("No metadata defined for this document.", "மெட்டாடேட்டா எதுவும் சேர்க்கப்படவில்லை.", "පාරදත්ත එකතු කර නොමැත.")}
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={startEdit}>
                {tr("Add Metadata", "மெட்டாடேட்டாவைச் சேர்", "පාරදත්ත එක් කරන්න")}
              </button>
            </div>
          )}

          <details style={{ marginTop: 20 }}>
            <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--ink-lt)" }}>
              {tr("View Raw JSON", "மூல JSON வடிவத்தைக் காட்டு", "මුල් JSON ආකෘතිය පෙන්වන්න")}
            </summary>
            <pre className="snippet" style={{ marginTop: 10 }}>{JSON.stringify(current, null, 2)}</pre>
          </details>
        </div>
      ) : (
        <form onSubmit={save} style={{ maxWidth: 680 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
            {METADATA_FIELDS.map((f) => (
              <div key={f.key}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>
                  {tr(...f.label)}{f.required ? " *" : ""}
                </label>
                {f.options ? (
                  <select
                    className="form-input"
                    style={inputStyle}
                    value={form[f.key] || f.options[0]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  >
                    {f.options.map((o) => (
                      <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    style={inputStyle}
                    value={form[f.key] || ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    required={f.required}
                  />
                )}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                {tr("Custom Metadata Fields", "கூடுதல் புலங்கள் (Custom Fields)", "අමතර ක්ෂේත්‍ර (Custom Fields)")}
              </label>
              <button
                type="button"
                onClick={() => setCustomFields([...customFields, { key: "", value: "" }])}
                style={{
                  background: "none", border: "1px dashed var(--forest)", color: "var(--forest)",
                  borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                + {tr("Add Field", "புலம் சேர்", "ක්ෂේත්‍රයක් එක් කරන්න")}
              </button>
            </div>

            {customFields.map((cf, idx) => (
              <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="Key / Attribute"
                  value={cf.key}
                  onChange={(e) => updateCustomField(idx, "key", e.target.value)}
                  style={{ ...inputStyle, flex: 1, width: "auto", padding: "7px 10px", fontSize: 13 }}
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={cf.value}
                  onChange={(e) => updateCustomField(idx, "value", e.target.value)}
                  style={{ ...inputStyle, flex: 2, width: "auto", padding: "7px 10px", fontSize: 13 }}
                />
                <button
                  type="button"
                  onClick={() => setCustomFields(customFields.filter((_, i) => i !== idx))}
                  style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 16, padding: "4px 8px" }}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? tr("Saving...", "சேமிக்கிறது...", "සුරකිමින් පවතී...")
                : tr("Save Metadata", "மாற்றங்களைச் சேமி", "වෙනස්කම් සුරකින්න")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
              {tr("Cancel", "ரத்துசெய்", "අවලංගු කරන්න")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function DocumentView() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [appLang, setAppLang] = useState(() => localStorage.getItem("lrw_lang") || "");

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError("");
    setTab("overview");

    getDocument(id)
      .then((data) => { if (!cancelled) setDoc(data); })
      .catch((e) => { if (!cancelled) setError(getErrorMessage(e, "Failed to load document.")); });

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    const handleLang = (e) => setAppLang(e.detail);
    window.addEventListener("lrw_lang_changed", handleLang);
    return () => window.removeEventListener("lrw_lang_changed", handleLang);
  }, []);

  if (error) {
    return (
      <div className="page" style={{ maxWidth: 720 }}>
        <div className="alert-error">{error}</div>
        <Link to="/" className="btn btn-ghost btn-sm">← Back to dashboard</Link>
      </div>
    );
  }
  if (!doc) return <div className="page"><p className="muted">Loading…</p></div>;

  const nlp = doc.nlp || {};
  const lang = appLang || nlp.language || "English";
  const tr = makeTr(lang);
  const baseName = doc.filename?.replace(/\.[^.]+$/, "") || "document";

  const tabs = [
    { key: "overview", label: tr("Overview", "கண்ணோட்டம்", "දළ විශ්ලේෂණය") },
    { key: "raw", label: tr("Raw Text", "அசல் உரை", "මුල් පෙළ") },
    { key: "cleaned", label: tr("Cleaned Text", "சுத்திகரிக்கப்பட்ட உரை", "පිරිසිදු කළ පෙළ") },
    ...(doc.nlp ? [{ key: "nlp", label: tr("NLP Data", "NLP தரவு", "NLP දත්ත") }] : []),
    { key: "metadata", label: tr("Meta Data", "மெட்டாடேட்டா", "පාරදත්ත") },
  ];

  return (
    <div className="page">
      <div className="page-header fade-up">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link to="/" className="muted" style={{ fontSize: 13, marginBottom: 6, display: "inline-block" }}>
              ← {tr("Dashboard", "முகப்பு", "පුවරුව")}
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
              <span className="muted">{formatDate(doc.created_at)}</span>
              {nlp.token_count != null && <span className="muted">{nlp.token_count.toLocaleString()} tokens</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: "auto", alignSelf: "flex-start" }}>
            {["json", "csv"].map((format) => (
              <button
                key={format}
                className="btn btn-ghost btn-sm"
                type="button"
                title={`Download ${format.toUpperCase()} format`}
                onClick={() => exportDocument(id, format, baseName)}
              >
                📥 {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card fade-up fade-up-1">
        <div className="tabs">
          {tabs.map(({ key, label }) => (
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

        {tab === "overview" && <OverviewTab doc={doc} nlp={nlp} tr={tr} />}
        {tab === "raw" && <pre className="snippet">{doc.raw_text}</pre>}
        {tab === "cleaned" && <pre className="snippet">{doc.cleaned_text}</pre>}
        {tab === "nlp" && doc.nlp && <NlpTab nlp={nlp} lang={lang} tr={tr} />}
        {tab === "metadata" && (
          <MetadataTab
            docId={id}
            metadata={doc.metadata}
            tr={tr}
            onSaved={(metadata) => setDoc((prev) => ({ ...prev, metadata }))}
          />
        )}
      </div>
    </div>
  );
}
