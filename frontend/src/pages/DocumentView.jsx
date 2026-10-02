import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { getDocument, exportDocument, updateDocumentMetadata } from "../api";

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
    key: "tokens",
    label: { English: "Tokenization", Tamil: "சொல் பிரித்தல்", Sinhala: "ටෝකනීකරණය" },
    desc: {
      English: "Segments the text into individual tokens.",
      Tamil: "உரையை தனித்தனி சொற்களாகப் பிரிக்கிறது.",
      Sinhala: "පෙළ වෙන වෙනම ටෝකනවලට වෙන් කරයි.",
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
      English: "Identifies the base or dictionary form of inflected words in English, Tamil, and Sinhala.",
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
      Tamil: "எழுத்துக்கள், சொற்கள், தனித்துவ சொற்கள் மற்றும் பத்திகள் பற்றிய முழுமையான புள்ளிவிவரங்கள்.",
      Sinhala: "අක්ෂර, ටෝකන, අනන්‍ය වචන සහ ඡේද පිළිබඳ සවිස්තරාත්මක සංඛ්‍යාලේඛන.",
    },
  },
  {
    key: "charts",
    label: { English: "Visual Charts", Tamil: "வரைபடங்கள்", Sinhala: "ප්‍රස්ථාර" },
    desc: {
      English: "Visual summaries of token frequency, sentence lengths, POS, lemmas, morphology, vocabulary, and document structure.",
      Tamil: "சொல் நிகழ்வெண், வாக்கிய நீளம், சொல் வகை, வேர்ச்சொல், உருபியல், சொற்களஞ்சியம் மற்றும் ஆவண அமைப்பின் காட்சிப்படுத்தல்.",
      Sinhala: "ටෝකන සංඛ්‍යාතය, වාක්‍ය දිග, පද වර්ග, මූල පද, රූපවිද්‍යාව, වචන මාලාව සහ ලේඛන ව්‍යුහයේ දෘශ්‍ය සාරාංශ.",
    },
  },
];

const POS_INFO = {
  NOUN: {
    en: "Noun",
    ta: "பெயர்ச்சொல்",
    si: "නාම පදය",
    desc_en: "Names a person, place, object, or idea in a sentence.",
    desc_ta: "ஒரு நபர், இடம், பொருள் அல்லது எண்ணத்தை பெயரிட்டு காட்டும் சொல்.",
    desc_si: "වාක්‍යයක පුද්ගලයෙකු, ස්ථානයක්, වස්තුවක් හෝ අදහසක් නම් කරයි.",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  PROPN: {
    en: "Proper Noun",
    ta: "சிறப்புப் பெயர்ச்சொல்",
    si: "විශේෂ නාම පදය",
    desc_en: "Names a specific person, place, title, or organization.",
    desc_ta: "ஒரு குறிப்பிட்ட நபர், இடம், தலைப்பு அல்லது அமைப்பின் பெயரை குறிக்கும் சொல்.",
    desc_si: "විශේෂිත පුද්ගලයෙක්, ස්ථානයක්, මාතෘකාවක් හෝ සංවිධානමක් නම් කරයි.",
    color: "#2563eb",
    bg: "#dbeafe",
    border: "#93c5fd",
  },
  VERB: {
    en: "Verb",
    ta: "வினைச்சொல்",
    si: "ක්‍රියා පදය",
    desc_en: "Shows an action, event, or state of being in a sentence.",
    desc_ta: "செயல், நிகழ்வு அல்லது நிலையை வெளிப்படுத்தும் சொல்.",
    desc_si: "ක්‍රියාවක්, සිදුවීමක් හෝ පැවතීමේ තත්වයක් දැක්වයි.",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  AUX: {
    en: "Auxiliary Verb",
    ta: "துணைவினை",
    si: "සහායක ක්‍රියාව",
    desc_en: "Helps the main verb by showing tense, mood, or voice.",
    desc_ta: "முதன்மை வினையின் காலம், மனநிலை அல்லது குரலை காட்ட உதவும் சொல்.",
    desc_si: "ප්‍රධාන ක්‍රියා පදයට කාලය, ආකල්පය හෝ ශබ්දය දක්වා උපකාර කරයි.",
    color: "#0f766e",
    bg: "#f0fdfa",
    border: "#99f6e4",
  },
  ADJ: {
    en: "Adjective",
    ta: "பெயரடை",
    si: "නාම විශේෂණය",
    desc_en: "Describes a noun or gives more detail about it.",
    desc_ta: "பெயர்ச்சொல்லின் பண்பை விளக்கும் அல்லது விரிவாக்கும் சொல்.",
    desc_si: "නාම පදයක් විස්තර කර එහි ගුණාංග හෙළි කරයි.",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  ADV: {
    en: "Adverb",
    ta: "வினையடை",
    si: "ක්‍රියා විශේෂණය",
    desc_en: "Describes how, when, where, or to what degree an action happens.",
    desc_ta: "செயல் எவ்வாறு, எப்போது, எங்கே அல்லது எவ்வளவு தீவிரமாக நடந்தது என்பதை விளக்கும் சொல்.",
    desc_si: "ක්‍රියාවක් කොහොම, කවදා, කොහේ හෝ වඩා හොඳින් සිදු වනවාද යන්න විස්තර කරයි.",
    color: "#c2410c",
    bg: "#fff7ed",
    border: "#fed7aa",
  },
  PRON: {
    en: "Pronoun",
    ta: "பிரதிப்பெயர் (சுட்டுப்பெயர்)",
    si: "සර්වනාමය",
    desc_en: "Replaces a noun such as he, she, it, they, or you.",
    desc_ta: "அவர், அவள், அது, அவர்கள், நீ போன்ற பெயர்ச்சொல்லுக்கு பதிலாக வரும் சொல்.",
    desc_si: "ඔහු, ඔයා, එය, ඔවුන් වැනි නාම පද වෙනුවට යොදා ගන්නා පදය.",
    color: "#7e22ce",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
  CONJ: {
    en: "Conjunction",
    ta: "இணைப்புச்சொல்",
    si: "සම්බන්ධක පදය",
    desc_en: "Links words, phrases, or clauses to create a complete sentence.",
    desc_ta: "சொற்கள், சொற்றொடர்கள் அல்லது வாக்கியங்களை இணைத்து பொருளை முழுமையாக்கும் சொல்.",
    desc_si: "වචන, වාක්‍ය ඛණ්ඩ හෝ වාක්‍ය සම්බන්ධ කර සම්පූර්ණ වාක්‍යයක් ගොඩනඟයි.",
    color: "#0e7490",
    bg: "#ecfeff",
    border: "#a5f3fc",
  },
  CCONJ: {
    en: "Coordinating Conjunction",
    ta: "இணைப்புச்சொல்",
    si: "සම්බන්ධක පදය",
    desc_en: "Connects two equal ideas or elements such as and, but, or.",
    desc_ta: "மற்றும், ஆனால், அல்லது போன்ற சமமான கருத்துகளை இணைக்கும் சொல்.",
    desc_si: "සමාන අදහස් හෝ වචන දෙකක් සහ, නමුත්, හෝ වැනි ලෙස සම්බන්ධ කරයි.",
    color: "#0e7490",
    bg: "#ecfeff",
    border: "#a5f3fc",
  },
  SCONJ: {
    en: "Subordinating Conjunction",
    ta: "சார்ந்த இணைப்புச்சொல்",
    si: "උපකාරක සම්බන්ධකය",
    desc_en: "Introduces a dependent clause that supports the main idea.",
    desc_ta: "முதன்மை கருத்துக்கு துணைபுரியும் சார்ந்த வாக்கியத்தை அறிமுகம் செய்கிறது.",
    desc_si: "ප්‍රධාන අදහසට අනුගත වන උප වාක්‍යක් හඳුන්වා දෙයි.",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  ADP: {
    en: "Postposition / Preposition",
    ta: "இடைச்சொல் (வேற்றுமை)",
    si: "නිපාතය / උපසර්ගය",
    desc_en: "Shows position, time, or grammatical relationship between words.",
    desc_ta: "சொற்களுக்கிடையே இடம், காலம் அல்லது இலக்கண உறவை காட்டும் சொல்.",
    desc_si: "වචන අතර ස්ථානය, කාලය හෝ ව්‍යාකරණ සම්බන්ධතාවය දක්වයි.",
    color: "#047857",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  },
  POSTP: {
    en: "Postposition",
    ta: "இடைச்சொல்",
    si: "පසුනිපාතය",
    desc_en: "Appears after a word to show a grammatical relationship.",
    desc_ta: "ஒரு சொல்லின் பின்னால் வந்து அதன் உறவு அல்லது தொடர்பை காட்டும் சொல்.",
    desc_si: "වචනයක පසුපසින් එල්ලී ව්‍යාකරණ සම්බන්ධතාවයක් දක්වයි.",
    color: "#047857",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  },
  NUM: {
    en: "Numeral",
    ta: "எண்ணுப்பெயர் / எண்",
    si: "සංඛ්‍යා පදය",
    desc_en: "Shows a number, count, or quantity in the text.",
    desc_ta: "உரைநடையில் எண்ணிக்கை, அளவு அல்லது எண் மதிப்பைக் காட்டும் சொல்.",
    desc_si: "පෙළෙහි සංඛ්‍යාවක්, ප්‍රමාණයක් හෝ ගණනයක් දක්වයි.",
    color: "#4338ca",
    bg: "#eef2ff",
    border: "#c7d2fe",
  },
  PUNCT: {
    en: "Punctuation",
    ta: "நிறுத்தற்குறி",
    si: "විරාම ලකුණු",
    desc_en: "Marks pauses or structure in writing such as commas and periods.",
    desc_ta: "காற்புள்ளி, நிறுத்தற்குறி போன்றவற்றால் வாசிப்பை அமைத்து நிறுத்தங்களை காட்டும் குறியீடு.",
    desc_si: "කොමාව, අවධාන කර ඇති ලකුණු වැනි දිරාපත් කර ඇති ලකුණු පෙළේ ව්‍යුහය නිරූපණය කරයි.",
    color: "#475569",
    bg: "#f8fafc",
    border: "#cbd5e1",
  },
  DET: {
    en: "Determiner",
    ta: "சுட்டுச்சொல்",
    si: "නිරූපකය",
    desc_en: "Points to a noun and limits or identifies it such as the, a, this, or that.",
    desc_ta: "தி, ஒரு, இது, அது போன்ற சொற்கள் பெயர்ச்சொல்லை குறிப்பிட்டு வரம்பிடுகின்றன.",
    desc_si: "the, a, this, that වැනි වචන නාම පදයක් පෙන්වා එය හඳුනා ගනී.",
    color: "#a21caf",
    bg: "#fdf4ff",
    border: "#f5d0fe",
  },
  PART: {
    en: "Particle",
    ta: "இடைச்சொல் / அசை",
    si: "අංශු පදය",
    desc_en: "A short grammatical word that adds meaning or emphasis to a sentence.",
    desc_ta: "வாக்கியத்தில் அர்த்தம் அல்லது முக்கியத்துவத்தை சேர்க்கும் சிறிய இலக்கணச் சொல்.",
    desc_si: "වාක්‍යයක අර්ථය හෝ අවධානය එක් කරන කෙටි ව්‍යාකරණ පදය.",
    color: "#be185d",
    bg: "#fdf2f8",
    border: "#fbcfe8",
  },
  INTJ: {
    en: "Interjection",
    ta: "வியப்பிடைச்சொல்",
    si: "විස්මයාර්ථය",
    desc_en: "Expresses strong emotion, surprise, or an exclamation in speech.",
    desc_ta: "உணர்ச்சி, ஆச்சரியம் அல்லது பதிலிறுப்பு போன்ற எண்ணத்தை வெளிப்படுத்தும் சொல்.",
    desc_si: "හිත, විස්මය හෝ අභිප්‍රේරණය ප්‍රකාශ කරන පදය.",
    color: "#be123c",
    bg: "#fff1f2",
    border: "#fecdd3",
  },
  SYM: {
    en: "Symbol",
    ta: "குறியீடு",
    si: "සංකේතය",
    desc_en: "Represents a mathematical, technical, or special symbol in the text.",
    desc_ta: "கணித, தொழில்நுட்ப அல்லது சிறப்பு குறியீட்டைக் குறிக்கும் சொல்லல்லாத குறி.",
    desc_si: "ගණිත, තාක්ෂණික හෝ විශේෂ සංකේතය නිරූපණය කරයි.",
    color: "#334155",
    bg: "#f1f5f9",
    border: "#cbd5e1",
  },
  X: {
    en: "Other / Foreign",
    ta: "மற்றவை",
    si: "වෙනත්",
    desc_en: "An unclassified token or word from another language category.",
    desc_ta: "வகைப்படுத்தப்படாத சொல் அல்லது மற்ற மொழி வகையைச் சேர்ந்த சொல்.",
    desc_si: "වර්ගීකරණය නොකළ වචනයක් හෝ වෙනම භාෂා වර්ගයක පදයකි.",
    color: "#6b7280",
    bg: "#f3f4f6",
    border: "#d1d5db",
  },
};

const getPosInfo = (tag) => {
  if (!tag) return POS_INFO.X;
  const upper = String(tag).toUpperCase();
  return POS_INFO[upper] || POS_INFO.X;
};

const getPosLabel = (tag, lang) => {
  const info = getPosInfo(tag);
  if (lang === "Tamil") return info.ta;
  if (lang === "Sinhala") return info.si;
  return info.en;
};

const getPosDesc = (tag, lang) => {
  const info = getPosInfo(tag);
  if (lang === "Tamil") return info.desc_ta;
  if (lang === "Sinhala") return info.desc_si;
  return info.desc_en;
};

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
  const [nlpSec, setNlpSec] = useState("tokens");
  const [selectedPosFilter, setSelectedPosFilter] = useState(null);
  const [posSearchQuery, setPosSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [appLang, setAppLang] = useState(localStorage.getItem("lrw_lang") || "");

  // Metadata editing state
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({});
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaMsg, setMetaMsg] = useState(null);
  const [customFields, setCustomFields] = useState([]);

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

  const handleStartEditMeta = () => {
    const currentMeta = doc?.metadata || {};
    const standardKeys = ["source", "license", "domain", "author", "publication_date", "category"];
    const baseForm = {
      source: currentMeta.source || "",
      license: currentMeta.license || "",
      domain: currentMeta.domain || "",
      author: currentMeta.author || "",
      publication_date: currentMeta.publication_date || "",
      category: currentMeta.category || "open",
    };
    const extras = Object.entries(currentMeta)
      .filter(([k]) => !standardKeys.includes(k))
      .map(([key, value]) => ({
        key,
        value: typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
      }));
    setMetaForm(baseForm);
    setCustomFields(extras);
    setMetaMsg(null);
    setIsEditingMeta(true);
  };

  const handleSaveMeta = async (e) => {
    if (e) e.preventDefault();
    setMetaSaving(true);
    setMetaMsg(null);

    const payload = { ...metaForm };
    customFields.forEach(({ key, value }) => {
      if (key && key.trim()) {
        payload[key.trim()] = value;
      }
    });

    try {
      const res = await updateDocumentMetadata(id, payload);
      setDoc((prev) => ({
        ...prev,
        metadata: res.metadata || payload,
      }));
      setMetaMsg({
        type: "success",
        text: isTamil ? "மெட்டாடேட்டா வெற்றிகரமாக புதுப்பிக்கப்பட்டது." :
          isSinhala ? "පාරදත්ත සාර්ථකව යාවත්කාලීන කරන ලදී." :
          "Metadata updated successfully."
      });
      setIsEditingMeta(false);
    } catch (err) {
      setMetaMsg({
        type: "error",
        text: err.response?.data?.detail || (
          isTamil ? "மெட்டாடேட்டாவை புதுப்பிப்பதில் தோல்வி." :
          isSinhala ? "පාරදත්ත යාවත්කාලීන කිරීම අසාර්ථක විය." :
          "Failed to update metadata."
        )
      });
    } finally {
      setMetaSaving(false);
    }
  };

  const handleAddCustomField = () => {
    setCustomFields([...customFields, { key: "", value: "" }]);
  };

  const handleUpdateCustomField = (index, field, val) => {
    const updated = [...customFields];
    updated[index][field] = val;
    setCustomFields(updated);
  };

  const handleRemoveCustomField = (index) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

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

  // Chart datasets
  const posData = Object.entries(nlp.pos_distribution || {})
    .map(([pos, count]) => ({
      pos,
      name: getPosLabel(pos, lang),
      label: `${getPosLabel(pos, lang)} (${pos})`,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const topWordsData = (nlp.top_words || []).slice(0, 15)
    .map((item) => {
      if (Array.isArray(item)) return { word: item[0], count: item[1] };
      return { word: item.word || "", count: item.count || 0 };
    });

  const lemmaPairs = (nlp.token_details || []).filter(tok => tok.lemma && tok.text !== tok.lemma).slice(0, 100);
  const morphTokens = (nlp.token_details || []).filter(tok => tok.morph && tok.morph !== "").slice(0, 50);

  const translateMorph = (morphStr) => {
    if (!morphStr) return "";
    const MORPH_TAMIL = {
      "Case=Nom": "எழுவாய்", "Case=Acc": "இரண்டாம் வேற்றுமை (ஐ)", "Case=Dat": "நான்காம் வேற்றுமை (கு)",
      "Case=Gen": "ஆறாம் வேற்றுமை (இன்)", "Case=Abl": "ஐந்தாம் வேற்றுமை (இலிருந்து)", "Case=Loc": "ஏழாம் வேற்றுமை (இல்)",
      "Case=Ins": "மூன்றாம் வேற்றுமை (ஆல்)", "Case=Com": "உடன் வேற்றுமை",
      "Case=Ben": "நான்காம் வேற்றுமை (பொருட்டு/க்காக)",
      "Number=Sing": "ஒருமை", "Number=Plur": "பன்மை", "Gender=Masc": "ஆண்பால்",
      "Gender=Fem": "பெண்பால்", "Gender=Neut": "ஒன்றன்பால்", "Definiteness=Indef": "பொதுமை",
      "Definiteness=Def": "குறிப்புமை", "NumType=Card": "எண்ணுப்பெயர்", "PronType=Int": "வினாப்பெயர்",
      "PronType=Art": "சுட்டிடைச்சொல்", "PronType=Prs": "தனிப்பெயர்", "PronType=Dem": "சுட்டுப்பெயர்",
      "Reflex=Yes": "தற்சுட்டு", "AdpType=Post": "பின்சேர்க்கை இடைச்சொல்",
      "Polarity=Pos": "உடன்பாட்டு நிலை", "Gender=Com": "பொதுப்பால்", "Polite=Form": "மரியாதை வடிவம்",
      "Polite=Yes": "மரியாதை", "Polite=No": "மரியாதையற்ற வடிவம்", "Polarity=Neg": "எதிர்மறை",
      "Tense=Past": "இறந்தகாலம்", "Tense=Pres": "நிகழ்காலம்", "Tense=Fut": "எதிர்காலம்",
      "VerbForm=Inf": "தொழிற்பெயர்", "VerbForm=Fin": "முற்று வினை", "VerbForm=Part": "பெயரெச்சம்/வினையெச்சம்",
      "Voice=Act": "செய்வினை", "Voice=Pass": "செயப்பாட்டுவினை",
      "Aspect=Perf": "நிறைவடைந்த நிலை", "Aspect=Prog": "தொடர்நிலை",
      "Mood=Imp": "ஏவல் வினை (முன்னிலை)", "Mood=Pot": "சாத்திய முறைமை", "Mood=Des": "விழைவு முறைமை",
      "Mood=Proh": "விலக்கல் முறைமை (கூடாது)", "Mood=Opt": "வியங்கோள் வினை", "Mood=Cond": "நிபந்தனை முறைமை",
      "Person=1": "தன்மை", "Person=2": "முன்னிலை", "Person=3": "படர்க்கை",
    };
    return morphStr.split("|").map((feature) => {
      if (MORPH_TAMIL[feature]) return MORPH_TAMIL[feature];
      const [name, value] = feature.split("=");
      const names = {
        AdpType: "இடைச்சொல் வகை", Polarity: "வினைநிலை", Gender: "பால்", Polite: "மரியாதை",
      };
      const values = {
        Post: "பின்சேர்க்கை", Pos: "உடன்பாடு", Neg: "எதிர்மறை", Com: "பொதுப்பால்",
        Form: "வடிவம்", Yes: "ஆம்", No: "இல்லை",
      };
      if (name && value && names[name] && values[value]) return `${names[name]}: ${values[value]}`;
      return "கூடுதல் உருபியல் அம்சம்";
    }).join(" | ");
  };

  const tokenDetails = nlp.token_details || [];
  const sentenceTokenCounts = tokenDetails.reduce((counts, token) => {
    const sentenceId = Number(token.sentence_id) || 1;
    counts[sentenceId] = (counts[sentenceId] || 0) + 1;
    return counts;
  }, {});
  const sentenceLengthData = (nlp.sentences || []).slice(0, 15).map((sentence, index) => ({
    label: `#${index + 1}`,
    count: sentenceTokenCounts[index + 1] || sentence.trim().split(/\s+/).filter(Boolean).length,
  }));
  const morphologyCounts = tokenDetails.reduce((counts, token) => {
    (token.morph || "").split("|").filter(Boolean).forEach((feature) => {
      const label = translateMorph(feature);
      counts[label] = (counts[label] || 0) + 1;
    });
    return counts;
  }, {});
  const morphologyData = Object.entries(morphologyCounts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
  const changedLemmaCount = tokenDetails.filter((token) => token.lemma && (token.text || token.token) !== token.lemma).length;
  const lemmaData = [
    { label: isTamil ? "மாறிய வேர்ச்சொற்கள்" : isSinhala ? "වෙනස් වූ මූල පද" : "Changed to lemma", count: changedLemmaCount },
    { label: isTamil ? "மாறாத சொற்கள்" : isSinhala ? "වෙනස් නොවූ පද" : "Unchanged tokens", count: Math.max(tokenDetails.length - changedLemmaCount, 0) },
  ];
  const vocabularyData = [
    { label: isTamil ? "மொத்த சொற்கள்" : isSinhala ? "මුළු ටෝකන" : "Total tokens", count: stats.tokens ?? nlp.token_count ?? 0 },
    { label: isTamil ? "தனித்துவமான சொற்கள்" : isSinhala ? "අනන්‍ය ටෝකන" : "Unique tokens", count: stats.unique_tokens ?? nlp.unique_tokens ?? 0 },
  ];
  const structureData = [
    { label: isTamil ? "வாக்கியங்கள்" : isSinhala ? "වාක්‍ය" : "Sentences", count: stats.sentences ?? nlp.sentence_count ?? 0 },
    { label: isTamil ? "பத்திகள்" : isSinhala ? "ඡේද" : "Paragraphs", count: stats.paragraphs ?? 0 },
  ];
  const characterData = [
    { label: isTamil ? "மொத்த எழுத்துக்கள்" : isSinhala ? "මුළු අක්ෂර" : "All characters", count: stats.characters ?? 0 },
    { label: isTamil ? "இடைவெளி நீக்கி" : isSinhala ? "හිස්තැන් රහිත" : "Without spaces", count: stats.characters_without_spaces ?? 0 },
  ];
  const wordFrequencyData = topWordsData.map(({ word, count }) => ({ label: word, count }));
  const posChartData = posData.map(({ name, pos, count }) => ({ label: `${name} (${pos})`, count }));

  const renderAnalysisChart = (title, data, color = "var(--forest)") => (
    <div style={{ background: "var(--bg-lt)", borderRadius: 10, padding: 18, border: "1px solid var(--border)", minWidth: 0 }}>
      <h4 style={{ color: "var(--forest)", margin: "0 0 14px 0", fontSize: 14 }}>{title}</h4>
      {data.length ? (
        <div style={{ width: "100%", height: Math.max(220, Math.min(data.length * 34, 420)) }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={130} />
              <Tooltip />
              <Bar dataKey="count" fill={color} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>{isTamil ? "வரைபடத்திற்கான தரவு இல்லை." : isSinhala ? "ප්‍රස්ථාරයට දත්ත නොමැත." : "No data available for this chart."}</p>
      )}
    </div>
  );

  const TABS = [
    { key: "overview", label: isTamil ? "கண்ணோட்டம்" : isSinhala ? "දළ විශ්ලේෂණය" : "Overview" },
    { key: "cleaned", label: isTamil ? "சுத்திகரிக்கப்பட்ட உரை" : isSinhala ? "පිරිසිදු කළ පෙළ" : "Cleaned Text" },
    { key: "raw", label: isTamil ? "அசல் உரை" : isSinhala ? "මුල් පෙළ" : "Raw Text" },
    ...(doc.nlp ? [
      { key: "nlp", label: isTamil ? "NLP தரவு" : isSinhala ? "NLP දත්ත" : "NLP Data" },
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
      case "pos": {
        const totalPosCount = Object.values(nlp.pos_distribution || {}).reduce((acc, v) => acc + (typeof v === "number" ? v : 0), 0) || 1;
        const allTokens = nlp.token_details || [];
        const filteredTokens = allTokens.filter(tk => {
          const matchPos = !selectedPosFilter || (tk.pos || "").toUpperCase() === selectedPosFilter.toUpperCase();
          const matchQuery = !posSearchQuery.trim() ||
            (tk.text || tk.token || "").toLowerCase().includes(posSearchQuery.toLowerCase());
          return matchPos && matchQuery;
        });

        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />

            {/* Document Language Indicator */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: 10, marginBottom: 16,
              background: "var(--bg-lt)", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)"
            }}>
              <div style={{ fontSize: 13, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>
                  {isTamil ? "ஆவண மொழி இலக்கண வகைப்பாடு:" : isSinhala ? "ලේඛන භාෂා ව්‍යාකරණ වර්ගීකරණය:" : "Document Language Grammatical POS:"}
                </span>
                <span className="badge" style={{ background: "var(--mint)", color: "var(--forest)", fontWeight: 700 }}>
                  {nlp.language || lang}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-lt)" }}>
                {isTamil ? `மொத்த வகைகள்: ${Object.keys(nlp.pos_distribution || {}).length}` :
                  isSinhala ? `මුළු කාණ්ඩ: ${Object.keys(nlp.pos_distribution || {}).length}` :
                    `Total POS Categories: ${Object.keys(nlp.pos_distribution || {}).length}`}
              </div>
            </div>

            {/* POS Cards / Chips */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 20 }}>
              {Object.entries(nlp.pos_distribution || {}).map(([pos, count]) => {
                const info = getPosInfo(pos);
                const localizedName = getPosLabel(pos, lang);
                const pct = Math.round((count / totalPosCount) * 100);
                const isSelected = selectedPosFilter === pos;

                return (
                  <div
                    key={pos}
                    onClick={() => setSelectedPosFilter(isSelected ? null : pos)}
                    title={getPosDesc(pos, lang)}
                    style={{
                      cursor: "pointer",
                      padding: "12px 14px",
                      borderRadius: 8,
                      border: isSelected ? `2px solid ${info.color}` : `1px solid ${info.border}`,
                      background: isSelected ? info.bg : "var(--paper)",
                      boxShadow: isSelected ? `0 2px 8px ${info.border}` : "none",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 6px",
                          borderRadius: 4, background: info.bg, color: info.color,
                          border: `1px solid ${info.border}`
                        }}>
                          {pos}
                        </span>
                        <strong style={{ fontSize: 13, color: "var(--ink)" }}>{localizedName}</strong>
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: info.color,
                        background: info.bg, padding: "2px 8px", borderRadius: 12
                      }}>
                        {count}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: "var(--ink-lt)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                        {getPosDesc(pos, lang)}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-lt)" }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Words Table for POS */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                    {isTamil ? "சொற்கள் வாரியான இலக்கண விபரம்" : isSinhala ? "වචන අනුව ව්‍යාකරණ විස්තරය" : "Words by Part-of-Speech"}
                  </h4>
                  {selectedPosFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedPosFilter(null)}
                      style={{
                        background: "none", border: "1px solid var(--border)", borderRadius: 12,
                        padding: "2px 8px", fontSize: 11, color: "var(--ink-lt)", cursor: "pointer"
                      }}
                    >
                      ✕ {isTamil ? "வடிப்பை நீக்கு" : isSinhala ? "පෙරහන ඉවත් කරන්න" : "Clear Filter"} ({selectedPosFilter})
                    </button>
                  )}
                </div>

                {/* Filter Search Input */}
                <input
                  type="text"
                  value={posSearchQuery}
                  onChange={(e) => setPosSearchQuery(e.target.value)}
                  placeholder={isTamil ? "சொல்லைத் தேடுங்கள்..." : isSinhala ? "වචනයක් සොයන්න..." : "Search word..."}
                  style={{
                    padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
                    fontSize: 12, background: "var(--paper)", color: "var(--ink)", width: 220
                  }}
                />
              </div>

              <div style={scrollBox}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: 35 }}>#</th>
                      <th style={th}>{isTamil ? "சொல்" : isSinhala ? "වචනය (ටෝකනය)" : "Token"}</th>
                      <th style={{ ...th, width: 170 }}>{isTamil ? "இலக்கண வகை (POS)" : isSinhala ? "පද වර්ගය (POS)" : "Part-of-Speech"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTokens.slice(0, 200).map((tk, i) => {
                      const posInfo = getPosInfo(tk.pos);
                      const localizedPos = getPosLabel(tk.pos, lang);
                      return (
                        <tr key={i}>
                          <td style={{ ...tdStyle(i % 2), color: "var(--ink-lt)" }}>{i + 1}</td>
                          <td style={{ ...tdStyle(i % 2), fontWeight: 600 }}>{tk.token || tk.text}</td>
                          <td style={tdStyle(i % 2)}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "3px 8px", borderRadius: 6,
                              background: posInfo.bg, color: posInfo.color,
                              border: `1px solid ${posInfo.border}`, fontSize: 12, fontWeight: 600
                            }}>
                              <span>{localizedPos}</span>
                              <span style={{ opacity: 0.7, fontSize: 10, fontWeight: 700 }}>({tk.pos})</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTokens.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ padding: 24, textAlign: "center", color: "var(--ink-lt)" }}>
                          {isTamil ? "பொருந்தும் சொற்கள் எதுவும் இல்லை." : isSinhala ? "ගැලපෙන වචන හමු නොවීය." : "No matching tokens found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      }

      case "tokens":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={{ ...scrollBox, padding: 14 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 8 }}>
                {(nlp.tokens || (nlp.token_details || []).map((tk) => tk.token || tk.text)).map((token, i) => (
                  <span key={`${token}-${i}`} style={{
                    display: "inline-flex", alignItems: "center", padding: "6px 10px",
                    borderRadius: 7, border: "1px solid var(--border)",
                    background: "var(--bg-lt)", fontSize: 14, lineHeight: 1.5,
                  }}>
                    {token}
                  </span>
                ))}
              </div>
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
                      <th style={th}>{isTamil ? "வேர்ச்சொல்" : isSinhala ? "මූල ස්වරූපය" : "Base Form (Lemma)"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lemmaPairs.map((tk, i) => (
                      <tr key={i}>
                        <td style={tdStyle(i % 2)}><strong>{tk.text || tk.token}</strong></td>
                        <td style={{ ...tdStyle(i % 2), color: "var(--ink-lt)" }}>→</td>
                        <td style={{ ...tdStyle(i % 2), color: "var(--forest)", fontWeight: 600 }}>{tk.lemma}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>
                {isTamil ? "அனைத்து வார்த்தைகளும் ஏற்கனவே அவற்றின் வேர்ச்சொல் வடிவத்தில் உள்ளன." :
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
                    <th style={th}>உருபியல் கூறுகள்</th>
                  </tr>
                </thead>
                <tbody>
                  {(morphTokens.length > 0 ? morphTokens : (nlp.token_details || []).slice(0, 50)).map((tk, i) => {
                    return (
                      <tr key={i}>
                        <td style={{ ...tdStyle(i % 2), fontWeight: 600 }}>{tk.text || tk.token}</td>
                        <td style={{ ...tdStyle(i % 2), color: "var(--ink)", fontSize: 12 }}>
                          {tk.morph ? translateMorph(tk.morph) : "—"}
                        </td>
                      </tr>
                    );
                  })}
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

      case "charts":
        return (
          <div>
            <SectionDesc desc={t(currentSection?.desc)} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
              {renderAnalysisChart(isTamil ? "அடிக்கடி வரும் சொற்கள்" : isSinhala ? "නිතර භාවිත වන වචන" : "Most Frequent Tokens", wordFrequencyData, "#4a7c59")}
              {renderAnalysisChart(isTamil ? "சொல் வகைப் பகிர்வு (POS)" : isSinhala ? "පද වර්ග බෙදාහැරීම (POS)" : "Part-of-Speech Distribution", posChartData, "#1a3a2a")}
              {renderAnalysisChart(isTamil ? "வாக்கியம் வாரியான சொல் எண்ணிக்கை" : isSinhala ? "වාක්‍යයකට ටෝකන ගණන" : "Tokens per Sentence", sentenceLengthData, "#386641")}
              {renderAnalysisChart(isTamil ? "உருபியல் அம்சங்களின் எண்ணிக்கை" : isSinhala ? "රූපවිද්‍යාත්මක ලක්ෂණ ගණන" : "Morphological Feature Counts", morphologyData, "#6aaa80")}
              {renderAnalysisChart(isTamil ? "வேர்ச்சொல் மாற்றங்கள்" : isSinhala ? "මූල පද වෙනස්වීම්" : "Lemmatization", lemmaData, "#2d5a3d")}
              {renderAnalysisChart(isTamil ? "சொற்களஞ்சிய அளவு" : isSinhala ? "වචන මාලාවේ ප්‍රමාණය" : "Vocabulary Size", vocabularyData, "#4a7c59")}
              {renderAnalysisChart(isTamil ? "ஆவண அமைப்பு" : isSinhala ? "ලේඛන ව්‍යුහය" : "Document Structure", structureData, "#8fb89a")}
              {renderAnalysisChart(isTamil ? "எழுத்து எண்ணிக்கை" : isSinhala ? "අක්ෂර ගණන" : "Character Counts", characterData, "#386641")}
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
                  {nlp.language}
                </span>
              )}
              <span className="muted">{new Date(doc.created_at).toLocaleDateString()}</span>
              {nlp.token_count != null && <span className="muted">{nlp.token_count.toLocaleString()} tokens</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: "auto", alignSelf: "flex-start", flexWrap: "wrap" }}>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              title="Download Full structured data (for developers)"
              onClick={() => exportDocument(id, "json", doc.filename?.split(".")[0] || "document")}
            >
              📥 JSON
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              title="Download Summary table (for spreadsheets)"
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
        {tab === "metadata" && (
          <div style={{ padding: "8px 0" }}>
            {/* Metadata Header with Edit Action */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>
                  {isTamil ? "ஆவண மெட்டாடேட்டா" : isSinhala ? "ලේඛන පාරදත්ත" : "Document Metadata"}
                </h3>
                <p className="muted" style={{ margin: "3px 0 0", fontSize: 13 }}>
                  {isTamil ? "ஆவணத்தின் மூல உரிமை, வகை மற்றும் விவரங்களை நிர்வகிக்கவும்." :
                    isSinhala ? "ලේඛනයේ මූලාශ්‍රය, බලපත්‍රය සහ අමතර තොරතුරු කළමනාකරණය කරන්න." :
                    "Manage document provenance, licensing, domain, and custom metadata."}
                </p>
              </div>

              {!isEditingMeta && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleStartEditMeta}
                >
                  {isTamil ? "மெட்டாடேட்டாவைத் திருத்து" : isSinhala ? "පාරදත්ත සංස්කරණය කරන්න" : "Edit Metadata"}
                </button>
              )}
            </div>

            {/* Notification alert */}
            {metaMsg && (
              <div
                className={metaMsg.type === "success" ? "alert-success" : "alert-error"}
                style={{
                  marginBottom: 16,
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  background: metaMsg.type === "success" ? "#dcfce7" : "#fee2e2",
                  color: metaMsg.type === "success" ? "#15803d" : "#b91c1c",
                  border: `1px solid ${metaMsg.type === "success" ? "#bbf7d0" : "#fecaca"}`
                }}
              >
                {metaMsg.text}
              </div>
            )}

            {!isEditingMeta ? (
              /* View Mode */
              <div>
                {doc.metadata && Object.keys(doc.metadata).length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
                    {[
                      { key: "source", label: isTamil ? "மூலம் (Source)" : isSinhala ? "මූලාශ්‍රය (Source)" : "Source", val: doc.metadata.source },
                      { key: "domain", label: isTamil ? "பிரிவு (Domain)" : isSinhala ? "ක්ෂේත්‍රය (Domain)" : "Domain", val: doc.metadata.domain },
                      { key: "license", label: isTamil ? "உரிமம் (License)" : isSinhala ? "බලපත්‍රය (License)" : "License", val: doc.metadata.license },
                      { key: "category", label: isTamil ? "வகை (Category)" : isSinhala ? "කාණ්ඩය (Category)" : "Category", val: doc.metadata.category },
                      { key: "author", label: isTamil ? "ஆசிரியர் (Author)" : isSinhala ? "කර්තෘ (Author)" : "Author", val: doc.metadata.author },
                      { key: "publication_date", label: isTamil ? "வெளியீட்டு தேதி" : isSinhala ? "ප්‍රකාශන දිනය" : "Publication Date", val: doc.metadata.publication_date },
                    ].map(({ key, label, val }) => (
                      <div key={key} style={{
                        background: "var(--bg-lt)", borderRadius: 8, padding: "14px 16px",
                        border: "1px solid var(--border)"
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-lt)", marginBottom: 6 }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                          {val || <span className="muted" style={{ fontWeight: 400 }}>—</span>}
                        </div>
                      </div>
                    ))}

                    {/* Additional Custom Keys */}
                    {Object.entries(doc.metadata)
                      .filter(([k]) => !["source", "domain", "license", "category", "author", "publication_date"].includes(k))
                      .map(([k, v]) => (
                        <div key={k} style={{
                          background: "var(--bg-lt)", borderRadius: 8, padding: "14px 16px",
                          border: "1px solid var(--border)"
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-lt)", marginBottom: 6 }}>
                            {k}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", wordBreak: "break-all" }}>
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div style={{
                    textAlign: "center", padding: "32px 16px", background: "var(--bg-lt)",
                    borderRadius: 8, marginBottom: 20
                  }}>
                    <p className="muted" style={{ margin: "0 0 12px 0" }}>
                      {isTamil ? "மெட்டாடேட்டா எதுவும் சேர்க்கப்படவில்லை." : isSinhala ? "පාරදත්ත එකතු කර නොමැත." : "No metadata defined for this document."}
                    </p>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleStartEditMeta}>
                      {isTamil ? "மெட்டாடேட்டாவைச் சேர்" : isSinhala ? "පාරදත්ත එක් කරන්න" : "Add Metadata"}
                    </button>
                  </div>
                )}

                {/* Raw JSON View Accordion */}
                <details style={{ marginTop: 20 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--ink-lt)" }}>
                    {isTamil ? "மூல JSON வடிவத்தைக் காட்டு" : isSinhala ? "මුල් JSON ආකෘතිය පෙන්වන්න" : "View Raw JSON"}
                  </summary>
                  <pre className="snippet" style={{ marginTop: 10 }}>{JSON.stringify(doc.metadata || {}, null, 2)}</pre>
                </details>
              </div>
            ) : (
              /* Edit Mode Form */
              <form onSubmit={handleSaveMeta} style={{ maxWidth: 680 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
                  
                  {/* Source */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>
                      {isTamil ? "மூலம் (Source) *" : isSinhala ? "මූලාශ්‍රය (Source) *" : "Source *"}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                      value={metaForm.source || ""}
                      onChange={(e) => setMetaForm({ ...metaForm, source: e.target.value })}
                      placeholder="e.g. Daily News, Wikipedia, Research Paper"
                      required
                    />
                  </div>

                  {/* Domain */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>
                      {isTamil ? "பிரிவு (Domain) *" : isSinhala ? "ක්ෂේත්‍රය (Domain) *" : "Domain *"}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                      value={metaForm.domain || ""}
                      onChange={(e) => setMetaForm({ ...metaForm, domain: e.target.value })}
                      placeholder="e.g. General, News, Technology, Legal, Sports"
                      required
                    />
                  </div>

                  {/* License */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>
                      {isTamil ? "உரிமம் (License) *" : isSinhala ? "බලපත්‍රය (License) *" : "License *"}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                      value={metaForm.license || ""}
                      onChange={(e) => setMetaForm({ ...metaForm, license: e.target.value })}
                      placeholder="e.g. CC-BY-4.0, MIT, Public Domain, All Rights Reserved"
                      required
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>
                      {isTamil ? "அணுகல் வகை (Category)" : isSinhala ? "ප්‍රවේශ කාණ්ඩය (Category)" : "Category"}
                    </label>
                    <select
                      className="form-input"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--paper)" }}
                      value={metaForm.category || "open"}
                      onChange={(e) => setMetaForm({ ...metaForm, category: e.target.value })}
                    >
                      <option value="open">Open</option>
                      <option value="research">Research</option>
                      <option value="restricted">Restricted</option>
                    </select>
                  </div>

                  {/* Author */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>
                      {isTamil ? "ஆசிரியர் (Author)" : isSinhala ? "කර්තෘ (Author)" : "Author"}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                      value={metaForm.author || ""}
                      onChange={(e) => setMetaForm({ ...metaForm, author: e.target.value })}
                      placeholder="e.g. Author or Organization name"
                    />
                  </div>

                  {/* Publication Date */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>
                      {isTamil ? "வெளியீட்டு தேதி (Publication Date)" : isSinhala ? "ප්‍රකාශන දිනය (Publication Date)" : "Publication Date"}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
                      value={metaForm.publication_date || ""}
                      onChange={(e) => setMetaForm({ ...metaForm, publication_date: e.target.value })}
                      placeholder="YYYY-MM-DD or text"
                    />
                  </div>
                </div>

                {/* Custom key-value pairs */}
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                      {isTamil ? "கூடுதல் புலங்கள் (Custom Fields)" : isSinhala ? "අමතර ක්ෂේත්‍ර (Custom Fields)" : "Custom Metadata Fields"}
                    </label>
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      style={{
                        background: "none", border: "1px dashed var(--forest)", color: "var(--forest)",
                        borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer"
                      }}
                    >
                      + {isTamil ? "புலம் சேர்" : isSinhala ? "ක්ෂේත්‍රයක් එක් කරන්න" : "Add Field"}
                    </button>
                  </div>

                  {customFields.map((cf, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      <input
                        type="text"
                        placeholder="Key / Attribute"
                        value={cf.key}
                        onChange={(e) => handleUpdateCustomField(idx, "key", e.target.value)}
                        style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}
                      />
                      <input
                        type="text"
                        placeholder="Value"
                        value={cf.value}
                        onChange={(e) => handleUpdateCustomField(idx, "value", e.target.value)}
                        style={{ flex: 2, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(idx)}
                        style={{
                          background: "none", border: "none", color: "var(--danger)",
                          cursor: "pointer", fontSize: 16, padding: "4px 8px"
                        }}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Form Action Buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={metaSaving}
                  >
                    {metaSaving ? (isTamil ? "சேமிக்கிறது..." : isSinhala ? "සුරකිමින් පවතී..." : "Saving...") :
                      (isTamil ? "மாற்றங்களைச் சேமி" : isSinhala ? "වෙනස්කම් සුරකින්න" : "Save Metadata")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { setIsEditingMeta(false); setMetaMsg(null); }}
                    disabled={metaSaving}
                  >
                    {isTamil ? "ரத்துசெய்" : isSinhala ? "අවලංගු කරන්න" : "Cancel"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

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
              {NLP_SECTIONS.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setNlpSec(key)}
                  style={{
                    display: "block",
                    width: "100%", padding: "10px 18px",
                    background: nlpSec === key ? "var(--card,#fff)" : "transparent",
                    border: "none",
                    borderLeft: nlpSec === key ? "3px solid var(--forest)" : "3px solid transparent",
                    color: nlpSec === key ? "var(--forest)" : "var(--ink-lt)",
                    fontWeight: nlpSec === key ? 600 : 400,
                    fontSize: 13, cursor: "pointer", textAlign: "left",
                  }}>
                  <span>{t(label)}</span>
                </button>
              ))}
            </div>

            {/* Content Panel */}
            <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto", minWidth: 0 }}>
              <h2 style={{
                margin: "0 0 16px 0", fontSize: 18, fontWeight: 700, color: "var(--ink)",
              }}>
                {t(currentSection?.label)}
              </h2>
              {renderNlpSection()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}