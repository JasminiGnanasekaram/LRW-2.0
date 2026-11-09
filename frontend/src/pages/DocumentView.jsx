import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
<<<<<<< HEAD
=======
import {
  getDocument,
  exportDocument,
  updateDocumentMetadata,
  updateDocumentNlp,
  updateDocumentCleanedText,
  crawlWebsite,
  discoverPages,
  crawlSpecificPage,
} from "../api";
>>>>>>> Miruthviga

import { getDocument, exportDocument, updateDocumentMetadata, updateDocumentNlp } from "../api";
const LANG_NAMES = { en: "English", ta: "Tamil", si: "Sinhala" };
const PIE_COLORS = ["#1a3a2a", "#4a7c59", "#8fb89a", "#d4e8d0", "#2d5a3d", "#6aaa80", "#b0d8b8", "#386641"];
const SENTIMENT_COLORS = { positive: "#22c55e", neutral: "#eab308", negative: "#ef4444" };
const LANG_COLORS = { English: "#3b82f6", Tamil: "#f97316", Sinhala: "#10b981", Other: "#8b5cf6" };

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
      Tamil: "உருபியல் பகுப்பாய்வு என்பது சொற்களின் கட்டமைப்பு, அவற்றின் தோற்றம் மற்றும் அவை எவ்வாறு உருவாகின்றன என்பதைப் பற்றி ஆராயும் ஒரு பகுப்பாய்வு முறை ஆகும்.",
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

const COMMON_MORPH_FEATURES = [
  {
    category: "Case",
    name: { English: "Grammatical Case", Tamil: "வேற்றுமை", Sinhala: "විභක්තිය" },
    items: [
      { key: "Case=Nom", label: "Nom (Nominative / எழுவாய்)" },
      { key: "Case=Acc", label: "Acc (Accusative / 2-ம் வேற்றுமை)" },
      { key: "Case=Dat", label: "Dat (Dative / 4-ம் வேற்றுமை)" },
      { key: "Case=Gen", label: "Gen (Genitive / 6-ம் வேற்றுமை)" },
      { key: "Case=Loc", label: "Loc (Locative / 7-ம் வேற்றுமை)" },
      { key: "Case=Ins", label: "Ins (Instrumental / 3-ம் வேற்றுமை)" },
      { key: "Case=Abl", label: "Abl (Ablative / 5-ம் வேற்றுமை)" },
      { key: "Case=Com", label: "Com (Comitative / உடன்)" },
      { key: "Case=Ben", label: "Ben (Benefactive / பொருட்டு)" },
    ],
  },
  {
    category: "Number",
    name: { English: "Number", Tamil: "எண்", Sinhala: "වචන" },
    items: [
      { key: "Number=Sing", label: "Singular (ஒருமை / ඒකවචන)" },
      { key: "Number=Plur", label: "Plural (பன்மை / බහුවචන)" },
    ],
  },
  {
    category: "Gender",
    name: { English: "Gender", Tamil: "பால்", Sinhala: "ලිංගය" },
    items: [
      { key: "Gender=Masc", label: "Masculine (ஆண்பால் / පුරුෂ)" },
      { key: "Gender=Fem", label: "Feminine (பெண்பால் / ස්ත්‍රී)" },
      { key: "Gender=Neut", label: "Neuter (ஒன்றன்பால் / නපුංසක)" },
    ],
  },
  {
    category: "Tense",
    name: { English: "Tense", Tamil: "காலம்", Sinhala: "කාලය" },
    items: [
      { key: "Tense=Past", label: "Past (இறந்தகாலம் / අතීත)" },
      { key: "Tense=Pres", label: "Present (நிகழ்காலம் / වර්තමාන)" },
      { key: "Tense=Fut", label: "Future (எதிர்காலம் / අනාගත)" },
    ],
  },
  {
    category: "Person",
    name: { English: "Person", Tamil: "இடம்", Sinhala: "පුරුෂ" },
    items: [
      { key: "Person=1", label: "1st Person (தன்மை / උත්තම)" },
      { key: "Person=2", label: "2nd Person (முன்னிலை / මධ්‍යම)" },
      { key: "Person=3", label: "3rd Person (படர்க்கை / ප්‍රථම)" },
    ],
  },
  {
    category: "Verb Form & Voice",
    name: { English: "Verb Form & Voice", Tamil: "வினை வடிவம்", Sinhala: "ක්‍රියා ස්වරූපය" },
    items: [
      { key: "VerbForm=Fin", label: "Finite (முற்றுவினை)" },
      { key: "VerbForm=Inf", label: "Infinitive (தொழிற்பெயர்)" },
      { key: "VerbForm=Part", label: "Participle (வினையெச்சம்)" },
      { key: "Voice=Act", label: "Active (செய்வினை)" },
      { key: "Voice=Pass", label: "Passive (செயப்பாட்டுவினை)" },
      { key: "Polarity=Neg", label: "Negative (எதிர்மறை)" },
      { key: "Polite=Yes", label: "Polite (மரியாதை)" },
    ],
  },
];

const METADATA_FIELDS = [
  { key: "source", label: ["Source", "மூலம் (Source)", "මූලාශ්‍රය (Source)"], required: true, placeholder: "e.g. Daily News, Wikipedia, Research Paper" },
  { key: "domain", label: ["Domain", "பிரிவு (Domain)", "ක්ෂේත්‍රය (Domain)"], required: true, placeholder: "e.g. General, News, Technology, Legal, Sports" },
  { key: "license", label: ["License", "உரிமம் (License)", "බලපත්‍රය (License)"], required: true, placeholder: "e.g. CC-BY-4.0, MIT, Public Domain, All Rights Reserved" },
  { key: "category", label: ["Category", "அணுகல் வகை (Category)", "ප්‍රවේශ කාණ්ඩය (Category)"], options: ["open", "research", "restricted"] },
  { key: "author", label: ["Author", "ஆசிரியர் (Author)", "කර්තෘ (Author)"], placeholder: "e.g. Author or Organization name" },
  { key: "publication_date", label: ["Publication Date", "வெளியீட்டு தேதி (Publication Date)", "ප්‍රකාශන දිනය (Publication Date)"], placeholder: "YYYY-MM-DD or text" },
  { key: "title", label: ["Title", "தலைப்பு (Title)", "මාතෘකාව (Title)"], placeholder: "Document title" },
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

// -----------------------------------------------------------------------------
// Download helpers: browser-only exports; no additional backend endpoint needed.
// Each NLP tab exports its own data without the 200-row display restriction.
// -----------------------------------------------------------------------------
const saveNlpDownload = (filename, data, mimeType) => {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const csvCell = (value) => {
  const raw = String(value ?? "");
  // Prevent formula execution in CSV viewers, including Excel.
  const safe = /^[\s]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

const downloadNlpCsv = (filename, headings, rows) => {
  const csv = [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  // UTF-8 BOM preserves Tamil and Sinhala text when opened directly in Excel.
  saveNlpDownload(filename, "\uFEFF" + csv, "text/csv;charset=utf-8");
};

const downloadNlpChartsSvg = (filename) => {
  const cards = Array.from(document.querySelectorAll('[data-nlp-export-chart="true"]'));
  const chartNodes = cards.map((card) => ({
    title: card.getAttribute("data-nlp-chart-title") || "Chart",
    svg: card.querySelector("svg.recharts-surface"),
  })).filter(({ svg }) => svg);
  if (!chartNodes.length) {
    throw new Error("No charts are available to download.");
  }

  const padding = 24;
  const headerHeight = 46;
  const gap = 22;
  const sizes = chartNodes.map(({ svg }) => ({
    width: Math.ceil(svg.getBoundingClientRect().width || Number(svg.getAttribute("width")) || 700),
    height: Math.ceil(svg.getBoundingClientRect().height || Number(svg.getAttribute("height")) || 300),
  }));
  const canvasWidth = Math.max(...sizes.map((size) => size.width)) + padding * 2;
  const canvasHeight = padding * 2 + sizes.reduce((total, size) => total + headerHeight + size.height + gap, 0);
  const escapeXml = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let y = padding;
  const panels = chartNodes.map(({ title, svg }, index) => {
    const size = sizes[index];
    const clone = svg.cloneNode(true);
    clone.setAttribute("x", String(padding));
    clone.setAttribute("y", String(y + headerHeight));
    clone.setAttribute("width", String(size.width));
    clone.setAttribute("height", String(size.height));
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const heading = `<text x="${padding}" y="${y + 25}" font-family="Arial, sans-serif" font-weight="bold" font-size="18" fill="#1a3a2a">${escapeXml(title)}</text>`;
    const drawing = new XMLSerializer().serializeToString(clone);
    y += headerHeight + size.height + gap;
    return heading + drawing;
  });
  const svgFile = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}"><rect width="100%" height="100%" fill="#fff"/>${panels.join("")}</svg>`;
  saveNlpDownload(filename, svgFile, "image/svg+xml;charset=utf-8");
};

// A structured, UTF-8 JSON file for the currently selected NLP analysis tab.
// All records supplied by the API are exported (not just the first 200 rows).
const buildNlpSectionJson = (sectionKey, nlp, docId, lang) => {
  const details = nlp.token_details || [];
  const byToken = (fn) => details.map((tk, index) => fn(tk, index));
  const base = {
    document_id: String(docId || "document"),
    section: sectionKey,
    language: nlp.language || lang || "",
  };

  switch (sectionKey) {
    case "tokens":
      return {
        ...base,
        count: details.length || (nlp.tokens || []).length,
        data: details.length
          ? byToken((tk, i) => ({ index: i + 1, token: tokenText(tk), sentence_id: tk.sentence_id ?? null }))
          : (nlp.tokens || []).map((token, i) => ({ index: i + 1, token })),
      };
    case "sentences":
      return {
        ...base,
        count: (nlp.sentences || []).length,
        data: (nlp.sentences || []).map((sentence, i) => ({ index: i + 1, sentence })),
      };
    case "pos":
      return {
        ...base,
        count: details.length,
        distribution: nlp.pos_distribution || {},
        data: byToken((tk, i) => ({
          index: i + 1, token: tokenText(tk), pos: tk.pos ?? null,
          pos_label: getPosLabel(tk.pos, lang), tag: tk.tag ?? null,
          language: tk.language ?? null, sentence_id: tk.sentence_id ?? null,
        })),
      };
    case "lemma":
      return {
        ...base,
        count: details.length,
        data: byToken((tk, i) => ({
          index: i + 1, token: tokenText(tk), lemma: tk.lemma || tokenText(tk),
          pos: tk.pos ?? null, language: tk.language ?? null,
          sentence_id: tk.sentence_id ?? null,
        })),
      };
    case "morph":
      return {
        ...base,
        count: details.length,
        data: byToken((tk, i) => ({
          index: i + 1, token: tokenText(tk), morph: tk.morph || "",
          features: String(tk.morph || "").split("|").map((f) => f.trim()).filter(Boolean),
          feature_description: translateMorph(tk.morph || "", lang),
          pos: tk.pos ?? null, language: tk.language ?? null,
          sentence_id: tk.sentence_id ?? null,
        })),
      };
    case "statistics":
      return {
        ...base,
        data: {
          ...(nlp.statistics || {}),
          tokens: nlp.statistics?.tokens ?? nlp.token_count ?? null,
          unique_tokens: nlp.statistics?.unique_tokens ?? nlp.unique_tokens ?? null,
          sentences: nlp.statistics?.sentences ?? nlp.sentence_count ?? null,
        },
      };
    case "charts": {
      const { sentenceChartData, posChartData, morphChartData } = buildNlpChartData(nlp, lang);
      return {
        ...base,
        // JSON contains the chart values; SVG contains the actual chart drawing.
        data: {
          tokens_per_sentence: sentenceChartData,
          pos_distribution: posChartData,
          morphological_features: morphChartData,
        },
      };
    }
    default:
      throw new Error("Unsupported NLP download type.");
  }
};

const downloadNlpJson = (filename, payload) => {
  saveNlpDownload(filename, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
};

const downloadNlpSection = (sectionKey, nlp, docId, lang, format = "csv") => {
  const filename = `LRW_${String(docId || "document").replace(/[^a-zA-Z0-9_-]/g, "_")}_${sectionKey}`;
  if (format === "json") {
    return downloadNlpJson(`${filename}.json`, buildNlpSectionJson(sectionKey, nlp, docId, lang));
  }
  if (format !== "csv" && format !== "svg") {
    throw new Error("Unsupported download format.");
  }

  const details = nlp.token_details || [];
  const rowsByToken = (makeRow) => details.map((tk, index) => makeRow(tk, index));

  switch (sectionKey) {
    case "tokens": {
      const rows = details.length
        ? rowsByToken((tk, i) => [i + 1, tokenText(tk), tk.sentence_id ?? ""])
        : (nlp.tokens || []).map((word, i) => [i + 1, word, ""]);
      return downloadNlpCsv(`${filename}.csv`, ["#", "Token", "Sentence ID"], rows);
    }
    case "sentences":
      return downloadNlpCsv(`${filename}.csv`, ["#", "Sentence"],
        (nlp.sentences || []).map((sentence, i) => [i + 1, sentence]));
    case "pos":
      return downloadNlpCsv(`${filename}.csv`, ["#", "Token", "POS", "POS Label", "Tag", "Language", "Sentence ID"],
        rowsByToken((tk, i) => [i + 1, tokenText(tk), tk.pos, getPosLabel(tk.pos, lang), tk.tag, tk.language, tk.sentence_id]));
    case "lemma":
      return downloadNlpCsv(`${filename}.csv`, ["#", "Token", "Lemma", "POS", "Language", "Sentence ID"],
        rowsByToken((tk, i) => [i + 1, tokenText(tk), tk.lemma || tokenText(tk), tk.pos, tk.language, tk.sentence_id]));
    case "morph":
      return downloadNlpCsv(`${filename}.csv`, ["#", "Token", "Morphological Features", "Feature Description", "POS", "Language", "Sentence ID"],
        rowsByToken((tk, i) => [i + 1, tokenText(tk), tk.morph || "", translateMorph(tk.morph, lang), tk.pos, tk.language, tk.sentence_id]));
    case "statistics": {
      const stats = nlp.statistics || {};
      const basicMetrics = [
        ["Total characters", stats.characters],
        ["Characters without spaces", stats.characters_without_spaces],
        ["Total tokens", stats.tokens ?? nlp.token_count],
        ["Unique tokens", stats.unique_tokens ?? nlp.unique_tokens],
        ["Sentence count", stats.sentences ?? nlp.sentence_count],
        ["Paragraph count", stats.paragraphs],
      ];
      const languageRows = Object.entries(stats.language_distribution || {}).map(([language, percent]) => [`Language: ${language} (%)`, percent]);
      const posRows = Object.entries(stats.pos_distribution || nlp.pos_distribution || {}).map(([pos, count]) => [`POS: ${pos}`, count]);
      return downloadNlpCsv(`${filename}.csv`, ["Metric", "Value"], [...basicMetrics, ...languageRows, ...posRows]);
    }
    case "charts":
      return downloadNlpChartsSvg(`${filename}.svg`);
    default:
      throw new Error("Unsupported NLP download type.");
  }
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

function ChartCard({ title, children, height = 280 }) {
  return (
    <div style={panelStyle} data-nlp-export-chart="true" data-nlp-chart-title={title}>
      <h4 style={{ color: "var(--forest)", margin: "0 0 14px 0", fontSize: 14 }}>{title}</h4>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function EditTokenModal({
  isOpen,
  token,
  tokenIndex,
  initialTab = "pos",
  lang,
  tr,
  totalOccurrences = 1,
  onSave,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [pos, setPos] = useState(token?.pos || "X");
  const [lemma, setLemma] = useState(token ? token.lemma || tokenText(token) : "");
  const [morph, setMorph] = useState(token?.morph || "");
  const [customFeatureKey, setCustomFeatureKey] = useState("");
  const [customFeatureValue, setCustomFeatureValue] = useState("");
  const [applyAll, setApplyAll] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    setActiveTab(initialTab);
    setPos(token.pos || "X");
    setLemma(token.lemma || tokenText(token));
    setMorph(token.morph || "");
    setCustomFeatureKey("");
    setCustomFeatureValue("");
    setApplyAll(true);
    setError(null);
  }, [token, initialTab]);

  if (!isOpen || !token) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        token_index: tokenIndex,
        word: tokenText(token),
        pos,
        lemma,
        morph,
        apply_all: applyAll,
      });
      onClose();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          tr("Failed to update token.", "சொல்லைப் புதுப்பிப்பதில் தோல்வி.", "ටෝකනය යාවත්කාලීන කිරීම අසාර්ථක විය.")
        )
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleMorphFeature = (feature) => {
    const existing = morph ? morph.split("|").filter(Boolean) : [];
    const prefix = feature.split("=")[0] + "=";
    let updated;
    if (existing.includes(feature)) {
      updated = existing.filter((f) => f !== feature);
    } else {
      updated = existing.filter((f) => !f.startsWith(prefix));
      updated.push(feature);
    }
    setMorph(updated.join("|"));
  };

  // New features can be combined with the existing morphological annotations.
  const addCustomFeature = () => {
    const key = customFeatureKey.trim();
    const value = customFeatureValue.trim();
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || !/^[A-Za-z0-9_-]+$/.test(value)) {
      setError(tr("Enter a valid feature and value (e.g. Evident=Yes).", "சரியான கூறும் மதிப்பும் வழங்குங்கள் (எ.கா. Evident=Yes).", "නිවැරදි ලක්ෂණයක් සහ අගයක් ඇතුළත් කරන්න."));
      return;
    }
    const entries = (morph || "").split("|").filter(Boolean);
    const next = entries.filter((entry) => entry.split("=")[0] !== key);
    next.push(`${key}=${value}`);
    setMorph(next.join("|"));
    setCustomFeatureKey("");
    setCustomFeatureValue("");
    setError(null);
  };

  const word = tokenText(token);
  const posInfo = getPosInfo(pos);
  const activeMorphs = new Set(morph ? morph.split("|").filter(Boolean) : []);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: 16,
    }}>
      <div style={{
        background: "var(--paper, #ffffff)", borderRadius: 12,
        width: "100%", maxWidth: 640, maxHeight: "90vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)",
        border: "1px solid var(--border)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          background: "var(--bg-lt)", display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                {tr("Add / Edit NLP Annotation", "NLP குறிப்பைச் சேர் / திருத்து", "NLP විවරණය එකතු / සංස්කරණය")}
              </span>
              <span className="badge" style={{ background: "var(--mint)", color: "var(--forest)", fontWeight: 700, fontSize: 13 }}>
                {word}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-lt)", marginTop: 4 }}>
              {tr("Index", "குறியீட்டு எண்", "දර්ශකය")}: #{tokenIndex + 1}
              {token.language && ` • ${tr("Lang", "மொழி", "භාෂාව")}: ${token.language.toUpperCase()}`}
              {totalOccurrences > 1 && ` • ${totalOccurrences} ${tr("occurrences in document", "முறை ஆவணத்தில் உள்ளது", "වාර ගණනක් ලේඛනයේ ඇත")}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none", border: "none", fontSize: 20,
              cursor: "pointer", color: "var(--ink-lt)", padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "flex", borderBottom: "1px solid var(--border)", background: "var(--bg-lt)", padding: "0 16px",
        }}>
          {[
            { key: "pos", label: tr("Part-of-Speech", "சொல் வகை (POS)", "පද වර්ගය (POS)") },
            { key: "lemma", label: tr("Lemmatization", "வேர்ச்சொல் (Lemma)", "ලේමටීකරණය") },
            { key: "morph", label: tr("Morphology", "உருபியல் (Morphology)", "රූපවිද්‍යාව") },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "10px 16px", border: "none", background: "none",
                cursor: "pointer", fontSize: 13,
                fontWeight: activeTab === t.key ? 700 : 500,
                color: activeTab === t.key ? "var(--forest)" : "var(--ink-lt)",
                borderBottom: activeTab === t.key ? "3px solid var(--forest)" : "3px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: "auto", padding: "20px", flex: 1 }}>
          {error && (
            <div className="alert-error" style={{ marginBottom: 16 }}>{error}</div>
          )}

          {/* POS Tab */}
          {activeTab === "pos" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>
                {tr("Select Part-of-Speech Tag:", "இலக்கண வகையைத் தேர்ந்தெடுக்கவும்:", "පද වර්ග ටැගය තෝරන්න:")}
              </label>

              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 8, maxHeight: 210, overflowY: "auto", padding: 2, marginBottom: 14,
              }}>
                {Object.keys(POS_INFO).map((tag) => {
                  const info = POS_INFO[tag];
                  const isSelected = pos === tag;
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => setPos(tag)}
                      title={getPosDesc(tag, lang)}
                      style={{
                        padding: "8px 10px", borderRadius: 8, textAlign: "left", cursor: "pointer",
                        border: isSelected ? `2px solid ${info.color}` : "1px solid var(--border)",
                        background: isSelected ? info.bg : "var(--paper)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: info.color }}>{tag}</span>
                        {isSelected && <span style={{ color: info.color, fontSize: 12, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {getPosLabel(tag, lang)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom POS tags not included in POS_INFO. */}
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                {tr("Add or enter a custom POS tag", "புதிய POS குறியீட்டைச் சேர்க்கவும்", "නව POS ටැගයක් ඇතුළත් කරන්න")}
              </label>
              <input
                type="text"
                value={pos}
                maxLength={32}
                onChange={(e) => setPos(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                placeholder="e.g. PROPN, AUX, CUSTOM"
                style={{ ...inputStyle, marginBottom: 14 }}
                required
              />

              {/* POS Preview Card */}
              <div style={{
                background: posInfo.bg, border: `1px solid ${posInfo.border}`,
                borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: posInfo.color,
                  padding: "2px 8px", background: "#fff", borderRadius: 4, border: `1px solid ${posInfo.border}`,
                }}>
                  {pos}
                </span>
                <div>
                  <strong style={{ fontSize: 13, color: posInfo.color }}>{getPosLabel(pos, lang)}</strong>
                  <div style={{ fontSize: 11, color: "var(--ink-lt)", marginTop: 2 }}>{getPosDesc(pos, lang)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Lemma Tab */}
          {activeTab === "lemma" && (
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 8, color: "var(--ink)" }}>
                {tr("Add or edit root word (Lemma):", "வேர்ச்சொல்லைச் சேர்க்கவும் அல்லது திருத்தவும்:", "මූල පදය එකතු කරන්න හෝ සංස්කරණය කරන්න:")}
              </label>
              <input
                type="text"
                className="form-input"
                value={lemma}
                onChange={(e) => setLemma(e.target.value)}
                placeholder="e.g. root/base word"
                style={{ ...inputStyle, fontSize: 14, fontWeight: 600, marginBottom: 10 }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setLemma(word)}
                  style={{
                    background: "none", border: "1px solid var(--border)", borderRadius: 6,
                    padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--ink)",
                  }}
                >
                  {tr("Same as Word", "அசல் சொல்", "මුල් වචනය")} ({word})
                </button>
                <button
                  type="button"
                  onClick={() => setLemma(word.toLowerCase())}
                  style={{
                    background: "none", border: "1px solid var(--border)", borderRadius: 6,
                    padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--ink)",
                  }}
                >
                  {tr("Lowercase", "சிறிய எழுத்து", "කුඩා අකුරු")} ({word.toLowerCase()})
                </button>
              </div>
              <div style={{
                background: "var(--bg-lt)", border: "1px solid var(--border)", borderRadius: 8,
                padding: "10px 14px", fontSize: 12, color: "var(--ink-lt)", lineHeight: 1.5,
              }}>
                {tr(
                  "Lemmatization normalizes words to their canonical dictionary root (e.g. 'marangal' → 'maram', 'walking' → 'walk').",
                  "வேர்ச்சொல் என்பது ஒரு சொல்லின் அடிப்படை அகராதி வடிவமாகும் (எ.கா. 'மரங்கள்' → 'மரம்', 'நடந்தான்' → 'நட').",
                  "ලේමටීකරණය මඟින් වචනයක ප්‍රභේද එහි මූලික ශබ්දකෝෂ ස්වරූපයට අඩු කරයි."
                )}
              </div>
            </div>
          )}

          {/* Morphology Tab */}
          {activeTab === "morph" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
                  {tr("Morphological Features:", "உருபியல் கூறுகள்:", "රූපවිද්‍යාත්මක ලක්ෂණ:")}
                </label>
                {morph && (
                  <button
                    type="button"
                    onClick={() => setMorph("")}
                    style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 11, cursor: "pointer" }}
                  >
                    {tr("Clear All", "அனைத்தையும் நீக்கு", "සියල්ල ඉවත් කරන්න")}
                  </button>
                )}
              </div>

              <input
                type="text"
                className="form-input"
                value={morph}
                onChange={(e) => setMorph(e.target.value)}
                placeholder="e.g. Case=Nom|Number=Sing|Tense=Past"
                style={{ ...inputStyle, fontSize: 13, marginBottom: 10, fontFamily: "monospace" }}
              />

              {/* Translation preview */}
              {morph && (
                <div style={{
                  marginBottom: 14, padding: "8px 12px", background: "#f0fdf4",
                  borderRadius: 6, border: "1px solid #bbf7d0", fontSize: 12, color: "#166534",
                }}>
                  <strong>{tr("Interpreted:", "விளக்கம்:", "අර්ථය:")} </strong>
                  {translateMorph(morph, lang) || morph}
                </div>
              )}

              {/* Existing / newly added features can be removed individually. */}
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
                {(morph || "").split("|").filter(Boolean).map((feature) => (
                  <button
                    key={feature}
                    type="button"
                    title={tr("Remove feature", "கூறை நீக்கு", "ලක්ෂණය ඉවත් කරන්න")}
                    onClick={() => setMorph((morph || "").split("|").filter((item) => item && item !== feature).join("|"))}
                    style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--paper)", color: "var(--forest)", cursor: "pointer" }}
                  >
                    {feature} ×
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 7 }}>
                {tr("Add custom morphological feature", "புதிய உருபியல் கூறைச் சேர்க்கவும்", "නව රූප විද්‍යා ලක්ෂණයක් එක් කරන්න")}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
                <input
                  type="text" value={customFeatureKey} onChange={(e) => setCustomFeatureKey(e.target.value)}
                  placeholder="Feature (e.g. Evident)" style={{ ...inputStyle, flex: "1 1 130px", width: "auto" }}
                />
                <input
                  type="text" value={customFeatureValue} onChange={(e) => setCustomFeatureValue(e.target.value)}
                  placeholder="Value (e.g. Yes)" style={{ ...inputStyle, flex: "1 1 110px", width: "auto" }}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={addCustomFeature}>
                  + {tr("Add Feature", "கூறைச் சேர்", "ලක්ෂණය එක් කරන්න")}
                </button>
              </div>

              {/* Quick toggle chips */}
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--ink-lt)", marginBottom: 6 }}>
                {tr("Quick Pick Features:", "விரைவு தேர்வு:", "ඉක්මන් තේරීම්:")}
              </div>
              <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}>
                {COMMON_MORPH_FEATURES.map((grp) => (
                  <div key={grp.category} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--forest)", marginBottom: 4 }}>
                      {pick(grp.name, lang)}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {grp.items.map((item) => {
                        const active = activeMorphs.has(item.key);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => toggleMorphFeature(item.key)}
                            style={{
                              padding: "3px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                              border: active ? "1px solid var(--forest)" : "1px solid var(--border)",
                              background: active ? "var(--forest)" : "var(--paper)",
                              color: active ? "#ffffff" : "var(--ink)",
                              fontWeight: active ? 600 : 400,
                              transition: "all 0.15s ease",
                            }}
                          >
                            {active ? "✓ " : "+ "}{item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scope selection */}
          <div style={{
            marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border)",
            background: "var(--bg-lt)", padding: "12px 14px", borderRadius: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
              {tr("Update Scope:", "புதுப்பிக்கும் பரப்பு:", "යාවත්කාලීන කිරීමේ විෂය පථය:")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="scope"
                  checked={applyAll}
                  onChange={() => setApplyAll(true)}
                />
                <span>
                  {tr(
                    `Apply to all occurrences of "${word}" in document (${totalOccurrences || 1} occurrences)`,
                    `ஆவணத்தில் உள்ள அனைத்து "${word}" சொற்களுக்கும் பொருத்துக (${totalOccurrences || 1} முறை)`,
                    `ලේඛනයේ ඇති සියලුම "${word}" සඳහා යොදන්න (${totalOccurrences || 1} වාරයක්)`
                  )}
                </span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="scope"
                  checked={!applyAll}
                  onChange={() => setApplyAll(false)}
                />
                <span>
                  {tr(
                    `Apply to this token instance only (Token #${tokenIndex + 1})`,
                    `இந்த ஒரு சொல்லுக்கு மட்டும் பொருத்துக (சொல் #${tokenIndex + 1})`,
                    `මෙම ටෝකනයට පමණක් යොදන්න (ටෝකනය #${tokenIndex + 1})`
                  )}
                </span>
              </label>
            </div>
          </div>

          {/* Footer Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              {tr("Cancel", "ரத்துசெய்", "අවලංගු කරන්න")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? tr("Saving...", "சேமிக்கிறது...", "සුරකිමින් පවතී...")
                : tr("Save NLP Changes", "மாற்றங்களைச் சேமி", "වෙනස්කම් සුරකින්න")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TokensSection({ nlp, tr, desc, onEditToken }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const allTokens = (nlp.token_details || []).map((tk, idx) => ({ ...tk, __index: idx }));
  const filtered = allTokens.filter((tk) => !needle || tokenText(tk).toLowerCase().includes(needle));

  return (
    <div>
      <SectionDesc desc={desc} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--ink-lt)" }}>
          {tr("Showing", "காட்டப்படுகிறது", "පෙන්වන්නේ")}: <strong>{filtered.length}</strong> / {allTokens.length}
        </div>
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Search token...", "சொல்லைத் தேடுங்கள்...", "ටෝකනය සොයන්න...")}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, background: "var(--paper)", color: "var(--ink)", width: 200 }}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start", padding: 16, maxHeight: 350, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "var(--paper)" }}>
        {filtered.map((tk) => (
          <span
            key={tk.__index}
            style={{ display: "inline-flex", padding: "8px 14px", borderRadius: 8, background: "var(--bg-lt)", border: "1px solid var(--border)", color: "var(--forest)", fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}
          >{tokenText(tk)}</span>
        ))}
        {filtered.length === 0 && <div style={{ color: "var(--ink-lt)" }}>{tr("No tokens found.", "சொற்கள் எதுவும் இல்லை.", "ටෝකන හමු නොවීය.")}</div>}
      </div>
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

function PosSection({ nlp, lang, tr, desc, onEditToken }) {
  const [filter, setFilter] = useState(null);
  const [query, setQuery] = useState("");

  const distribution = Object.entries(nlp.pos_distribution || {}).sort((a, b) => b[1] - a[1]);
  const total = distribution.reduce((sum, [, count]) => sum + (typeof count === "number" ? count : 0), 0) || 1;
  const needle = query.trim().toLowerCase();

  const allTokens = (nlp.token_details || []).map((tk, idx) => ({ ...tk, __index: idx }));

  const tokens = allTokens.filter((tk) => {
    const pos = (tk.pos || "").toUpperCase();
    if (filter && pos !== filter.toUpperCase()) return false;
    return !needle || tokenText(tk).toLowerCase().includes(needle) || pos.toLowerCase().includes(needle);
  });

  const rows = tokens.map((tk) => {
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
      <button
        type="button"
        onClick={() => onEditToken && onEditToken(tk, tk.__index, "pos")}
        className="btn btn-ghost btn-sm"
        style={{
          padding: "3px 8px", fontSize: 11, display: "inline-flex",
          alignItems: "center", gap: 4, borderRadius: 6,
          border: "1px solid var(--border)", color: "var(--forest)", cursor: "pointer",
        }}
      >
        {tr("Add / Edit POS", "POS சேர் / திருத்து", "POS එකතු / සංස්කරණය")}
      </button>,
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--ink-lt)" }}>
              {tokens.length} {tr("tokens", "சொற்கள்", "ටෝකන")}
            </span>
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
        </div>

        <ScrollTable
          headers={[
            { label: tr("Token", "சொல்", "වචනය (ටෝකනය)") },
            { label: tr("Part-of-Speech", "இலக்கண வகை (POS)", "පද වර්ගය (POS)") },
            { label: tr("Action", "செயல்", "ක්‍රියාව"), width: 110 },
          ]}
          rows={rows}
          emptyText={tr("No matching tokens found.", "பொருந்தும் சொற்கள் எதுவும் இல்லை.", "ගැලපෙන වචන හමු නොවීය.")}
        />
      </div>
    </div>
  );
}

function LemmaSection({ nlp, lang, tr, desc, onEditToken }) {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // 'modified' | 'all'

  const allTokens = (nlp.token_details || []).map((tk, idx) => ({ ...tk, __index: idx }));
  const needle = query.trim().toLowerCase();

  const lemmaChanged = allTokens.filter((tk) => {
    const text = tokenText(tk);
    return tk.lemma && text && tk.lemma.toLowerCase() !== text.toLowerCase();
  });

  const tokens = allTokens.filter((tk) => {
    const text = tokenText(tk);
    const lemma = tk.lemma || text;
    if (filterMode === "modified" && (!tk.lemma || text.toLowerCase() === tk.lemma.toLowerCase())) {
      return false;
    }
    return !needle || text.toLowerCase().includes(needle) || lemma.toLowerCase().includes(needle);
  });

  const rows = tokens.map((tk) => {
    const text = tokenText(tk);
    const isModified = tk.lemma && text.toLowerCase() !== tk.lemma.toLowerCase();
    return [
      <strong>{text}</strong>,
      <span style={{ color: "var(--ink-lt)" }}>→</span>,
      <span style={{ color: isModified ? "var(--forest)" : "var(--ink)", fontWeight: 600 }}>
        {tk.lemma || text}
      </span>,
      <span className="badge" style={{ fontSize: 11 }}>{tk.language || "en"}</span>,
      <button
        type="button"
        onClick={() => onEditToken && onEditToken(tk, tk.__index, "lemma")}
        className="btn btn-ghost btn-sm"
        style={{
          padding: "3px 8px", fontSize: 11, display: "inline-flex",
          alignItems: "center", gap: 4, borderRadius: 6,
          border: "1px solid var(--border)", color: "var(--forest)", cursor: "pointer",
        }}
      >
        {tr("Add / Edit Lemma", "வேர்ச்சொல் சேர் / திருத்து", "මූල පදය එකතු / සංස්කරණය")}
      </button>,
    ];
  });

  return (
    <div>
      <SectionDesc desc={desc} />

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 10, marginBottom: 16,
        background: "var(--bg-lt)", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setFilterMode("modified")}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: filterMode === "modified" ? "1px solid var(--forest)" : "1px solid var(--border)",
              background: filterMode === "modified" ? "var(--forest)" : "var(--paper)",
              color: filterMode === "modified" ? "#fff" : "var(--ink)",
              fontWeight: filterMode === "modified" ? 700 : 500,
            }}
          >
            {tr("Reduced to Base Form", "வேர்ச்சொல்லாக மாற்றப்பட்டவை", "මූල ස්වරූපයට අඩු කළ")} ({lemmaChanged.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: filterMode === "all" ? "1px solid var(--forest)" : "1px solid var(--border)",
              background: filterMode === "all" ? "var(--forest)" : "var(--paper)",
              color: filterMode === "all" ? "#fff" : "var(--ink)",
              fontWeight: filterMode === "all" ? 700 : 500,
            }}
          >
            {tr("All Tokens", "அனைத்து சொற்களும்", "සියලු ටෝකන")} ({allTokens.length})
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Search word or lemma...", "சொல்லைத் தேடுங்கள்...", "වචනයක් සොයන්න...")}
          style={{
            padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
            fontSize: 12, background: "var(--paper)", color: "var(--ink)", width: 220,
          }}
        />
      </div>

      <ScrollTable
        numbered={true}
        headers={[
          { label: tr("Original", "அசல் சொல்", "මුල් වචනය") },
          { label: "", width: 32 },
          { label: tr("Base Form (Lemma)", "வேர்ச்சொல்", "මූල ස්වරූපය") },
          { label: tr("Language", "மொழி", "භාෂාව"), width: 80 },
          { label: tr("Action", "செயல்", "ක්‍රියාව"), width: 110 },
        ]}
        rows={rows}
        emptyText={tr("No lemmatized words found.", "பொருந்தும் வேர்ச்சொற்கள் எதுவும் இல்லை.", "ගැලපෙන මූල පද හමු නොවීය.")}
      />
    </div>
  );
}

function MorphSection({ nlp, lang, tr, desc, onEditToken }) {
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all"); // 'has_morph' | 'all'

  const allTokens = (nlp.token_details || []).map((tk, idx) => ({ ...tk, __index: idx }));
  const needle = query.trim().toLowerCase();

  const tokensWithMorph = allTokens.filter((tk) => Boolean(tk.morph && tk.morph.trim()));

  const filtered = allTokens.filter((tk) => {
    if (filterMode === "has_morph" && (!tk.morph || !tk.morph.trim())) return false;
    if (!needle) return true;
    const text = tokenText(tk).toLowerCase();
    const morphStr = (tk.morph || "").toLowerCase();
    const translated = translateMorph(tk.morph, lang).toLowerCase();
    return text.includes(needle) || morphStr.includes(needle) || translated.includes(needle);
  });

  const rows = filtered.map((tk) => {
    const hasMorph = Boolean(tk.morph && tk.morph.trim());
    return [
      <strong>{tokenText(tk)}</strong>,
      hasMorph ? (
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 3 }}>
            {tk.morph.split("|").filter(Boolean).map((feat) => {
              const translated = (MORPH_LABELS[lang] || MORPH_LABELS.English)[feat] || feat;
              return (
                <span
                  key={feat}
                  className="badge"
                  style={{
                    fontSize: 11, padding: "2px 6px",
                    background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0",
                  }}
                  title={feat}
                >
                  {translated}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-lt)", fontFamily: "monospace" }}>
            {tk.morph}
          </div>
        </div>
      ) : (
        <span className="muted" style={{ fontSize: 12 }}>
          {tr("No morphological features assigned", "உருபியல் கூறுகள் இல்லை", "රූපවිද්‍යාත්මක ලක්ෂණ නොමැත")}
        </span>
      ),
      <button
        type="button"
        onClick={() => onEditToken && onEditToken(tk, tk.__index, "morph")}
        className="btn btn-ghost btn-sm"
        style={{
          padding: "3px 8px", fontSize: 11, display: "inline-flex",
          alignItems: "center", gap: 4, borderRadius: 6,
          border: "1px solid var(--border)", color: "var(--forest)", cursor: "pointer",
        }}
      >
        {tr("Add / Edit Features", "உருபியல் கூறு சேர் / திருத்து", "ලක්ෂණ එකතු / සංස්කරණය")}
      </button>,
    ];
  });

  return (
    <div>
      <SectionDesc desc={desc} />

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 10, marginBottom: 16,
        background: "var(--bg-lt)", padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setFilterMode("has_morph")}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: filterMode === "has_morph" ? "1px solid var(--forest)" : "1px solid var(--border)",
              background: filterMode === "has_morph" ? "var(--forest)" : "var(--paper)",
              color: filterMode === "has_morph" ? "#fff" : "var(--ink)",
              fontWeight: filterMode === "has_morph" ? 700 : 500,
            }}
          >
            {tr("Tokens with Features", "உருபியல் கூறுகள் உள்ளவை", "ලක්ෂණ සහිත ටෝකන")} ({tokensWithMorph.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
              border: filterMode === "all" ? "1px solid var(--forest)" : "1px solid var(--border)",
              background: filterMode === "all" ? "var(--forest)" : "var(--paper)",
              color: filterMode === "all" ? "#fff" : "var(--ink)",
              fontWeight: filterMode === "all" ? 700 : 500,
            }}
          >
            {tr("All Tokens", "அனைத்து சொற்களும்", "සියලු ටෝකන")} ({allTokens.length})
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Search word or feature...", "சொல் அல்லது கூறைத் தேடுங்கள்...", "වචනයක් හෝ ලක්ෂණයක් සොයන්න...")}
          style={{
            padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
            fontSize: 12, background: "var(--paper)", color: "var(--ink)", width: 230,
          }}
        />
      </div>

      <ScrollTable
        headers={[
          { label: tr("Word", "வார்த்தை", "වචනය"), width: 180 },
          { label: tr("Morphological Features", "இலக்கண உருபியல் கூறுகள்", "රූපවිද්‍යාත්මක ලක්ෂණ") },
          { label: tr("Action", "செயல்", "ක්‍රියාව"), width: 120 },
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


const countBy = (items, keyFn) => {
  const out = {};
  items.forEach((item) => {
    const key = keyFn(item);
    if (key !== undefined && key !== null && key !== "") out[key] = (out[key] || 0) + 1;
  });
  return out;
};

const MORPH_EXPANDED_LABELS = {
  English: {
    "Number=Sing": "Singular",
    "Number=Plur": "Plural",
    "Tense=Pres": "Present tense",
    "Tense=Past": "Past tense",
    "Tense=Fut": "Future tense",
    "VerbForm=Fin": "Finite verb",
    "VerbForm=Part": "Participle",
    "VerbForm=Inf": "Infinitive",
    "Person=1": "First person",
    "Person=2": "Second person",
    "Person=3": "Third person",
    "Aspect=Perf": "Perfective aspect",
    "Aspect=Prog": "Progressive aspect",
    "PronType=Prs": "Personal pronoun",
    "PronType=Art": "Article",
    "PronType=Dem": "Demonstrative",
    "PronType=Int": "Interrogative",
    "Definite=Def": "Article",
    "Definite=Ind": "Indefinite article",
    "Voice=Act": "Active voice",
    "Voice=Pass": "Passive voice",
    "Mood=Imp": "Imperative mood",
    "Mood=Ind": "Indicative mood",
    "Foreign=Yes": "Additional morphological feature",
    "Typo=Yes": "Additional morphological feature",
  },
  Tamil: {
    "Number=Sing": "ஒருமை",
    "Number=Plur": "பன்மை",
    "Tense=Pres": "நிகழ்காலம்",
    "Tense=Past": "இறந்தகாலம்",
    "Tense=Fut": "எதிர்காலம்",
    "VerbForm=Fin": "முற்று வினை",
    "VerbForm=Part": "பெயரெச்சம்/வினையெச்சம்",
    "VerbForm=Inf": "தொழிற்பெயர்",
    "Person=1": "தன்மை",
    "Person=2": "முன்னிலை",
    "Person=3": "படர்க்கை",
    "Aspect=Perf": "முடிந்த நிலை",
    "Aspect=Prog": "தொடர் நிலை",
    "PronType=Prs": "தன்மை/முன்னிலை/படர்க்கைப் பெயர்",
    "PronType=Art": "சுட்டுச்சொல்",
    "Foreign=Yes": "கூடுதல் உருபனியல் அம்சம்",
  },
  Sinhala: {
    "Number=Sing": "ඒකවචන",
    "Number=Plur": "බහුවචන",
    "Tense=Pres": "වර්තමාන කාලය",
    "Tense=Past": "අතීත කාලය",
    "Tense=Fut": "අනාගත කාලය",
    "VerbForm=Fin": "සීමිත ක්‍රියාව",
    "VerbForm=Part": "කෘදන්තය",
    "VerbForm=Inf": "අනියම් ක්‍රියාව",
    "Person=1": "උත්තම පුරුෂ",
    "Person=2": "මධ්‍යම පුරුෂ",
    "Person=3": "ප්‍රථම පුරුෂ",
    "Aspect=Perf": "සම්පූර්ණ ආකාරය",
    "PronType=Prs": "පුද්ගලික සර්වනාමය",
    "PronType=Art": "නිපාතය / උපපදය",
    "Foreign=Yes": "අමතර රූපවිද්‍යාත්මක ලක්ෂණය",
  },
};

const getMorphDisplayLabel = (feat, lang) => {
  if (!feat) return "";
  if (MORPH_EXPANDED_LABELS[lang]?.[feat]) return MORPH_EXPANDED_LABELS[lang][feat];
  if (MORPH_LABELS[lang]?.[feat]) return MORPH_LABELS[lang][feat];
  if (MORPH_EXPANDED_LABELS.English?.[feat]) return MORPH_EXPANDED_LABELS.English[feat];
  if (MORPH_LABELS.English?.[feat]) return MORPH_LABELS.English[feat];
  if (feat.startsWith("Foreign=") || feat.startsWith("Typo=") || feat.startsWith("ExtPos=")) {
    return lang === "Tamil"
      ? "கூடுதல் உருபனியல் அம்சம்"
      : lang === "Sinhala"
      ? "අමතර රූපවිද්‍යාත්මක ලක්ෂණය"
      : "Additional morphological feature";
  }
  if (feat.includes("=")) {
    const [, val] = feat.split("=");
    return val;
  }
  return feat;
};

// Use the same datasets for chart rendering and chart JSON downloads.
const buildNlpChartData = (nlp, lang) => {
  const tokens = nlp.token_details || [];

  // 1. Tokens per Sentence
  const sentenceTokenCounts = {};
  tokens.forEach((tk) => {
    if (tk.sentence_id != null) {
      sentenceTokenCounts[tk.sentence_id] = (sentenceTokenCounts[tk.sentence_id] || 0) + 1;
    }
  });

  const rawSentences = nlp.sentences || [];
  let sentenceChartData = rawSentences.slice(0, 25).map((s, idx) => {
    const sId = idx + 1;
    const count = sentenceTokenCounts[sId] != null
      ? sentenceTokenCounts[sId]
      : (typeof s === "string" ? s.trim().split(/\s+/).filter(Boolean).length : 0);
    return { name: `#${sId}`, count };
  });

  if (sentenceChartData.length === 0 && Object.keys(sentenceTokenCounts).length > 0) {
    sentenceChartData = Object.entries(sentenceTokenCounts)
      .map(([sId, count]) => ({ name: `#${sId}`, count }))
      .slice(0, 25);
  }

  // 2. Part-of-Speech Distribution
  const posChartData = Object.entries(nlp.pos_distribution || {})
    .map(([pos, count]) => ({
      name: `${getPosLabel(pos, lang)} (${pos})`,
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // 3. Morphological Feature Counts
  const morphCounts = {};
  tokens.forEach((tk) => {
    if (!tk.morph) return;
    String(tk.morph)
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => {
        const label = getMorphDisplayLabel(p, lang);
        if (label) morphCounts[label] = (morphCounts[label] || 0) + 1;
      });
  });

  const morphChartData = Object.entries(morphCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return { sentenceChartData, posChartData, morphChartData };
};

function ChartsSection({ nlp, lang, tr, desc }) {
  const { sentenceChartData, posChartData, morphChartData } = buildNlpChartData(nlp, lang);

  const cards = [
    sentenceChartData.length > 0 && (
      <ChartCard
        key="sent"
        title={tr("Tokens per Sentence", "வாக்கியத்திற்கான சொற்கள்", "වාක්‍යයකට ටෝකන")}
        height={Math.max(260, sentenceChartData.length * 28 + 40)}
      >
        <BarChart data={sentenceChartData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={50} interval={0} />
          <Tooltip />
          <Bar dataKey="count" fill="#2d5a3d" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>
    ),
    posChartData.length > 0 && (
      <ChartCard
        key="pos"
        title={tr("Part-of-Speech Distribution", "சொல் வகைப் பகிர்வு (POS)", "පද වර්ග බෙදාහැරීම (POS)")}
        height={Math.max(260, posChartData.length * 28 + 40)}
      >
        <BarChart data={posChartData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} interval={0} />
          <Tooltip />
          <Bar dataKey="count" fill="#1f3d2b" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>
    ),
    morphChartData.length > 0 && (
      <ChartCard
        key="morph"
        title={tr("Morphological Feature Counts", "உருபனியல் அம்ச எண்ணிக்கை", "රූපවිද්‍යාත්මක ලක්ෂණ ගණන")}
        height={Math.max(260, morphChartData.length * 28 + 40)}
      >
        <BarChart data={morphChartData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={180} interval={0} />
          <Tooltip />
          <Bar dataKey="count" fill="#5b9374" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartCard>
    ),
  ].filter(Boolean);

  return (
    <div>
      <SectionDesc desc={desc} />
      {cards.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
          {cards}
        </div>
      ) : (
        <div style={{ padding: 32, textAlign: "center", color: "var(--ink-lt)" }}>
          {tr("No visual chart data available.", "வரைபடத் தகவல்கள் எதுவும் இல்லை.", "ප්‍රස්ථාර දත්ත නොමැත.")}
        </div>
      )}
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

function NlpTab({ docId, nlp, lang, tr, onNlpUpdated }) {
  const [sectionKey, setSectionKey] = useState("tokens");
  const [editingToken, setEditingToken] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const section = NLP_SECTIONS.find((s) => s.key === sectionKey);
  const Section = SECTION_COMPONENTS[sectionKey];

  const handleStartEdit = (token, index, tab = "pos") => {
    const word = tokenText(token);
    const count = (nlp.token_details || []).filter(
      (t) => tokenText(t).toLowerCase() === word.toLowerCase()
    ).length;
    setEditingToken({ token, index, tab, occurrences: count });
  };

  const handleSaveEdit = async (patch) => {
    const res = await updateDocumentNlp(docId, patch);
    if (!res?.nlp) throw new Error("The server did not return updated NLP data.");
    onNlpUpdated?.(res.nlp);
    setFeedback({
      type: "success",
      text: tr("NLP annotation updated successfully.", "NLP சிறுகுறிப்பு வெற்றிகரமாக புதுப்பிக்கப்பட்டது.", "NLP විවරණය සාර්ථකව යාවත්කාලීන කරන ලදී."),
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div style={{ display: "flex", minHeight: 520, position: "relative" }}>
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
        {feedback && (
          <div
            className="alert-success"
            style={{
              marginBottom: 16, padding: "10px 14px", borderRadius: 8, fontSize: 13,
              background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0",
            }}
          >
            {feedback.text}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
            {pick(section?.label, lang)}
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(sectionKey === "charts" ? ["svg", "json"] : ["csv", "json"]).map((format) => (
              <button
                key={format}
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  try {
                    downloadNlpSection(sectionKey, nlp, docId, lang, format);
                  } catch (error) {
                    window.alert(error?.message || "Could not download this NLP section.");
                  }
                }}
                style={{ padding: "8px 14px", fontSize: 12, whiteSpace: "nowrap", cursor: "pointer" }}
                title={tr("Download this NLP section only", "இந்த NLP பகுதியை மட்டும் பதிவிறக்குக", "මෙම NLP කොටස පමණක් බාගන්න")}
              >
                ↓ {tr("Download", "பதிவிறக்குக", "බාගන්න")} {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <Section
          key={sectionKey}
          nlp={nlp}
          lang={lang}
          tr={tr}
          desc={pick(section?.desc, lang)}
          onEditToken={handleStartEdit}
        />
      </div>

      <EditTokenModal
        isOpen={Boolean(editingToken)}
        token={editingToken?.token}
        tokenIndex={editingToken?.index}
        initialTab={editingToken?.tab || "pos"}
        lang={lang}
        tr={tr}
        totalOccurrences={editingToken?.occurrences}
        onSave={handleSaveEdit}
        onClose={() => setEditingToken(null)}
      />
    </div>
  );
}

function WebCrawlerTab({ doc, tr, currentTab, onOpenOverview, onSelectPage, onDocumentUpdated }) {
  const navigate = useNavigate();
  const targetUrl = doc.filename || doc.metadata?.crawled_url || "";
  const [currentUrl, setCurrentUrl] = useState(targetUrl);
  const [crawlMaxPages, setCrawlMaxPages] = useState(10);
  const [crawling, setCrawling] = useState(false);
  const [totalAvailablePages, setTotalAvailablePages] = useState(doc?.total_available_pages || null);
  const [discovering, setDiscovering] = useState(false);

  // ── Crawl Mode: 'multiple' vs 'specific' ──
  const [crawlMode, setCrawlMode] = useState(() => {
    if (doc?.id) {
      try {
        const saved = localStorage.getItem(`lrw_crawler_mode_${doc.id}`);
        if (saved === "specific" || saved === "multiple") return saved;
      } catch { }
    }
    return "multiple";
  });
  const [selectedPageForCrawl, setSelectedPageForCrawl] = useState(() => {
    if (doc?.id) {
      try {
        const saved = localStorage.getItem(`lrw_selected_page_${doc.id}`);
        if (saved) return JSON.parse(saved);
      } catch { }
    }
    return null;
  });
  const [specificType, setSpecificType] = useState("page_number");
  const [specificPageNumber, setSpecificPageNumber] = useState(1);
  const [specificPageUrl, setSpecificPageUrl] = useState("");
  const [specificLoading, setSpecificLoading] = useState(false);
  const [specificError, setSpecificError] = useState("");
  const [specificStatus, setSpecificStatus] = useState("");
  const [viewMode, setViewMode] = useState("crawler"); // "crawler" | "available_pages"
  const [pageSearchFilter, setPageSearchFilter] = useState("");
  const [discoveredItems, setDiscoveredItems] = useState(() => {
    if (doc?.discovered_items && Array.isArray(doc.discovered_items) && doc.discovered_items.length > 0) {
      return doc.discovered_items;
    }
    if (doc?.discovered_pages && Array.isArray(doc.discovered_pages) && doc.discovered_pages.length > 0) {
      return doc.discovered_pages.map((pUrl, idx) => ({
        page_number: idx + 1,
        url: pUrl,
        title: pUrl.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ") || pUrl,
      }));
    }
    return [];
  });
  const [specificResult, setSpecificResult] = useState(() => {
    if (doc?.specific_page_crawl) return doc.specific_page_crawl;
    if (doc?.id) {
      try {
        const cached = localStorage.getItem(`lrw_specific_crawl_${doc.id}`);
        if (cached) return JSON.parse(cached);
      } catch { }
    }
    return null;
  });

  // ── Sync discovered items and total count when doc updates ──
  useEffect(() => {
    if (doc?.discovered_items && Array.isArray(doc.discovered_items) && doc.discovered_items.length > 0) {
      setDiscoveredItems(doc.discovered_items);
      setTotalAvailablePages(doc.discovered_items.length);
    } else if (doc?.discovered_pages && Array.isArray(doc.discovered_pages) && doc.discovered_pages.length > 0) {
      const items = doc.discovered_pages.map((pUrl, idx) => ({
        page_number: idx + 1,
        url: pUrl,
        title: pUrl.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ") || pUrl,
      }));
      setDiscoveredItems(items);
      setTotalAvailablePages(items.length);
    } else if (doc?.total_available_pages) {
      setTotalAvailablePages(doc.total_available_pages);
    }
  }, [doc?.id, doc?.discovered_items, doc?.discovered_pages, doc?.total_available_pages]);

  // ── Auto-discover total available pages under the website ──
  useEffect(() => {
    const url = (currentUrl || targetUrl).trim();
    if (!url) return;

    // Always fetch fresh discovery to ensure accurate count
    if (doc?.total_available_pages && doc?.discovered_items?.length && url === targetUrl) {
      setTotalAvailablePages(doc.discovered_items.length);
      setDiscoveredItems(doc.discovered_items);
      return;
    }

    let active = true;
    setDiscovering(true);
    discoverPages(url, doc?.id)
      .then((data) => {
        if (!active) return;
        const rawList = (data?.discovered_items && Array.isArray(data.discovered_items) && data.discovered_items.length > 0)
          ? data.discovered_items
          : (data?.discovered_pages && Array.isArray(data.discovered_pages) && data.discovered_pages.length > 0)
          ? data.discovered_pages.map((pUrl, idx) => ({ page_number: idx + 1, url: pUrl, title: pUrl.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ") || pUrl }))
          : [];
        const seenUrls = new Set();
        const uniqueList = [];
        rawList.forEach((it) => {
          if (!it || !it.url) return;
          const cleanU = it.url.split("#")[0].replace(/\/+$/, "");
          if (!seenUrls.has(cleanU)) {
            seenUrls.add(cleanU);
            uniqueList.push({ page_number: uniqueList.length + 1, url: it.url, title: it.title || it.url });
          }
        });
        if (uniqueList.length > 0) {
          setDiscoveredItems(uniqueList);
          setTotalAvailablePages(uniqueList.length);
        } else if (data?.total_available) {
          setTotalAvailablePages(data.total_available);
        }
        if (false && data?.total_available) {
          setTotalAvailablePages(data.total_available);
          if (data?.discovered_items && data.discovered_items.length > 0) {
            setDiscoveredItems(data.discovered_items);
          } else if (data?.discovered_pages && data.discovered_pages.length > 0) {
            setDiscoveredItems(
              data.discovered_pages.map((pUrl, idx) => ({
                page_number: idx + 1,
                url: pUrl,
                title: pUrl.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ") || pUrl,
              }))
            );
          }
        }
      })
      .catch(() => {
        if (active) {
          setTotalAvailablePages((prev) => prev || Math.max(1, crawlResults.length));
        }
      })
      .finally(() => {
        if (active) setDiscovering(false);
      });

    return () => { active = false; };
  }, [currentUrl, targetUrl, doc?.id]);

  // ── Scoped results: strictly load for THIS document ID / URL ──
  const [crawlResults, setCrawlResults] = useState(() => {
    if (doc?.crawled_pages && Array.isArray(doc.crawled_pages) && doc.crawled_pages.length > 0) {
      return doc.crawled_pages;
    }
    if (doc?.id) {
      try {
        const byId = localStorage.getItem(`lrw_crawler_${doc.id}`);
        if (byId) return JSON.parse(byId);
      } catch { }
    }
    return [];
  });

  const [crawlStatus, setCrawlStatus] = useState(() => {
    if (doc?.id) {
      try {
        const byId = localStorage.getItem(`lrw_crawler_status_${doc.id}`);
        if (byId) return byId;
      } catch { }
    }
    return "";
  });

  const [crawlError, setCrawlError] = useState("");

  // ── When doc changes, reset state to strictly match THIS document ──
  useEffect(() => {
    const url = doc.filename || doc.metadata?.crawled_url || "";
    setCurrentUrl(url);
    setCrawlError("");

    if (doc?.crawled_pages && Array.isArray(doc.crawled_pages) && doc.crawled_pages.length > 0) {
      setCrawlResults(doc.crawled_pages);
      setCrawlStatus(tr(
        `Loaded ${doc.crawled_pages.length} saved page(s).`,
        `${doc.crawled_pages.length} பக்கங்கள் ஏற்றப்பட்டன.`,
        `සුරකින ලද පිටු ${doc.crawled_pages.length} ක් පූරණය විය.`
      ));
    } else if (doc?.id) {
      const cached = localStorage.getItem(`lrw_crawler_${doc.id}`);
      if (cached) {
        try {
          setCrawlResults(JSON.parse(cached));
        } catch {
          setCrawlResults([]);
        }
      } else {
        setCrawlResults([]);
        setCrawlStatus("");
      }
    } else {
      setCrawlResults([]);
      setCrawlStatus("");
    }
    if (doc?.specific_page_crawl) {
      setSpecificResult(doc.specific_page_crawl);
    } else if (doc?.id) {
      try {
        const byId = localStorage.getItem(`lrw_specific_crawl_${doc.id}`);
        if (byId) setSpecificResult(JSON.parse(byId));
        else setSpecificResult(null);
      } catch {
        setSpecificResult(null);
      }
    } else {
      setSpecificResult(null);
    }
    if (doc?.id) {
      try {
        const sp = localStorage.getItem(`lrw_selected_page_${doc.id}`);
        setSelectedPageForCrawl(sp ? JSON.parse(sp) : null);
      } catch { setSelectedPageForCrawl(null); }
    } else { setSelectedPageForCrawl(null); }
  }, [doc?.id, doc?.filename]);

  useEffect(() => {
    if (doc?.id) {
      try {
        if (selectedPageForCrawl) localStorage.setItem(`lrw_selected_page_${doc.id}`, JSON.stringify(selectedPageForCrawl));
        else localStorage.removeItem(`lrw_selected_page_${doc.id}`);
      } catch { }
    }
  }, [selectedPageForCrawl, doc?.id]);

  useEffect(() => {
    if (doc?.id) {
      try {
        localStorage.setItem(`lrw_crawler_mode_${doc.id}`, crawlMode);
      } catch { }
    }
  }, [crawlMode, doc?.id]);

  useEffect(() => {
    if (doc?.id && specificResult) {
      try {
        localStorage.setItem(`lrw_specific_crawl_${doc.id}`, JSON.stringify(specificResult));
      } catch { }
    }
  }, [specificResult, doc?.id]);

  // ── Sync to localStorage strictly keyed by document ID ──
  useEffect(() => {
    if (doc?.id && crawlResults && crawlResults.length > 0) {
      try {
        localStorage.setItem(`lrw_crawler_${doc.id}`, JSON.stringify(crawlResults));
      } catch { }
    }
  }, [crawlResults, doc?.id]);

  useEffect(() => {
    if (doc?.id && crawlStatus) {
      try {
        localStorage.setItem(`lrw_crawler_status_${doc.id}`, crawlStatus);
      } catch { }
    }
  }, [crawlStatus, doc?.id]);

  // ── Execute crawl and update pages ──
  const executeCrawl = async () => {
    const urlToCrawl = (currentUrl || targetUrl).trim();
    if (!urlToCrawl) {
      setCrawlError(tr(
        "No valid URL found for this document.",
        "இந்த ஆவணத்திற்கான சரியான URL இல்லை.",
        "මෙම ලේඛනය සඳහා වලංගු URL එකක් හමු නොවීය."
      ));
      return;
    }
    setCrawlError("");
    setCrawling(true);

    setCrawlStatus(tr(
      `Crawling website starting from ${urlToCrawl} (up to ${crawlMaxPages} pages)...`,
      `வலைத்தளத்தை ${urlToCrawl} இலிருந்து ஊர்ந்து செல்கிறது (${crawlMaxPages} பக்கங்கள் வரை)...`,
      `${urlToCrawl} වෙතින් ආරම්භ කර වෙබ් අඩවිය ක්‍රෝල් කරයි (පිටු ${crawlMaxPages} දක්වා)...`
    ));

    try {
      const data = await crawlWebsite(urlToCrawl, Number(crawlMaxPages), doc?.id);
      const freshPages = data.pages || [];
      setCrawlResults(freshPages);

      setCrawlStatus(tr(
        `Successfully crawled ${freshPages.length} page(s).`,
        `வெற்றிகரமாக ${freshPages.length} பக்கங்கள் ஊரப்பட்டன.`,
        `පිටු ${freshPages.length} සාර්ථකව ක්‍රෝල් කරන ලදී.`
      ));

      if (typeof onDocumentUpdated === "function" && doc?.id) {
        onDocumentUpdated(doc.id);
      }
    } catch (err) {
      setCrawlError(err.response?.data?.detail || err.message || "Crawling failed.");
    } finally {
      setCrawling(false);
    }
  };

  const handleStartCrawlClick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const count = Number(crawlMaxPages);
    if (!count || count < 1) {
      alert(tr(
        "Please enter a valid number of pages to crawl (at least 1).",
        "ஊர்வதற்கு குறைந்தபட்சம் 1 பக்கத்தையாவது உள்ளிடவும்.",
        "ක්‍රෝල් කිරීමට වලංගු පිටු ගණනක් ඇතුළත් කරන්න (අවම වශයෙන් 1)."
      ));
      return;
    }
    if (totalAvailablePages !== null && totalAvailablePages !== undefined && count > totalAvailablePages) {
      alert(tr(
        `The entered number of pages (${count}) exceeds the total available pages (${totalAvailablePages}) on this website. Please enter a number between 1 and ${totalAvailablePages}.`,
        `உள்ளிடப்பட்ட பக்கங்களின் எண்ணிக்கை (${count}) இந்த வலைத்தளத்தின் மொத்த பக்கங்களை (${totalAvailablePages}) விட அதிகமாக உள்ளது. தயவுசெய்து 1 முதல் ${totalAvailablePages} வரையிலான எண்ணை உள்ளிடவும்.`,
        `ඇතුළත් කළ පිටු ගණන (${count}) මෙම වෙබ් අඩවියේ ඇති මුළු පිටු ගණන (${totalAvailablePages}) ඉක්මවා ඇත. කරුණාකර 1 සහ ${totalAvailablePages} අතර අංකයක් ඇතුළත් කරන්න.`
      ));
      return;
    }
    executeCrawl();
  };

  const handleClearResults = () => {
    if (window.confirm(tr(
      "Clear saved crawl results for this website?",
      "இந்த வலைத்தளத்திற்கான சேமிக்கப்பட்ட ஊர்தி முடிவுகளை அழிக்கவா?",
      "මෙම වෙබ් අඩවිය සඳහා සුරකින ලද ප්‍රතිඵල මකා දැමිය යුතුද?"
    ))) {
      setCrawlResults([]);
      setCrawlStatus("");
      setCrawlError("");
      try {
        if (doc?.id) {
          localStorage.removeItem(`lrw_crawler_${doc.id}`);
          localStorage.removeItem(`lrw_crawler_status_${doc.id}`);
        }
      } catch { }
    }
  };

  const executeSpecificCrawl = async () => {
    const baseUrl = (currentUrl || targetUrl).trim();
    if (!baseUrl) {
      setSpecificError(tr(
        "No valid website URL found for this document.",
        "இந்த ஆவணத்திற்கான சரியான வலைத்தள முகவரி இல்லை.",
        "මෙම ලේඛනය සඳහා වලංගු වෙබ් අඩවි URL එකක් හමු නොවීය."
      ));
      return;
    }

    if (!selectedPageForCrawl || !selectedPageForCrawl.url) {
      const msg = tr(
        "Please select a page from the available pages list to crawl.",
        "ஊர்வதற்கு இருக்கக்கூடிய பக்கங்களின் பட்டியலிலிருந்து ஒரு பக்கத்தைத் தேர்ந்தெடுக்கவும்.",
        "ක්‍රෝල් කිරීම සඳහා පවතින පිටු ලැයිස්තුවෙන් පිටුවක් තෝරන්න."
      );
      setSpecificError(msg);
      alert(msg);
      return;
    }
    if (false) {
      const pNum = Number(specificPageNumber);
      if (!pNum || pNum < 1) {
        const msg = tr(
          "Please enter a valid page number (at least 1).",
          "குறைந்தபட்சம் 1 பக்க எண்ணையாவது உள்ளிடவும்.",
          "වලංගු පිටු අංකයක් ඇතුළත් කරන්න (අවම වශයෙන් 1)."
        );
        setSpecificError(msg);
        alert(msg);
        return;
      }
      if (totalAvailablePages !== null && totalAvailablePages !== undefined && pNum > totalAvailablePages) {
        const msg = tr(
          `The entered page number (${pNum}) exceeds the total available pages (${totalAvailablePages}) on this website. Please enter a page number between 1 and ${totalAvailablePages}.`,
          `உள்ளிடப்பட்ட பக்க எண் (${pNum}) இந்த வலைத்தளத்தின் மொத்த பக்கங்களை (${totalAvailablePages}) விட அதிகமாக உள்ளது. தயவுசெய்து 1 முதல் ${totalAvailablePages} வரையிலான பக்க எண்ணை உள்ளிடவும்.`,
          `ඇතුළත් කළ පිටු අංකය (${pNum}) මෙම වෙබ් අඩවියේ ඇති මුළු පිටු ගණන (${totalAvailablePages}) ඉක්මවා ඇත. කරුණාකර 1 සහ ${totalAvailablePages} අතර පිටු අංකයක් ඇතුළත් කරන්න.`
        );
        setSpecificError(msg);
        alert(msg);
        return;
      }
    } else if (false) {
      const pUrl = (specificPageUrl || "").trim();
      if (!pUrl) {
        const msg = tr(
          "Please enter the direct URL of the specific page.",
          "குறிப்பிட்ட பக்கத்தின் நேரடி முகவரியை உள்ளிடவும்.",
          "නිශ්චිත පිටුවේ සෘජු URL එක ඇතුළත් කරන්න."
        );
        setSpecificError(msg);
        alert(msg);
        return;
      }
      try {
        const parsedTarget = new URL(pUrl.startsWith("http") ? pUrl : `https://${pUrl}`);
        const parsedBase = new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`);
        const cleanHost = (h) => h.toLowerCase().split(":")[0].replace(/^www\./, "");
        if (cleanHost(parsedTarget.hostname) !== cleanHost(parsedBase.hostname)) {
          const msg = tr(
            `The entered URL belongs to "${parsedTarget.hostname}", but must belong to this website domain ("${cleanHost(parsedBase.hostname)}").`,
            `உள்ளிடப்பட்ட URL "${parsedTarget.hostname}" க்கு சொந்தமானது, ஆனால் இந்த வலைத்தளத்திற்கு ("${cleanHost(parsedBase.hostname)}") சொந்தமானதாக இருக்க வேண்டும்.`,
            `ඇතුළත් කළ URL "${parsedTarget.hostname}" ට අයත් වේ, නමුත් මෙම වෙබ් අඩවියේ ඩොමේනයට ("${cleanHost(parsedBase.hostname)}") අයත් විය යුතුය.`
          );
          setSpecificError(msg);
          alert(msg);
          return;
        }
      } catch {
        const msg = tr(
          "Please enter a valid, complete web URL (e.g., https://example.com/article).",
          "சரியான வலைப்பக்க முகவரியை உள்ளிடவும் (எ.கா: https://example.com/article).",
          "කරුණාකර වලංගු සම්පූර්ණ වෙබ් URL එකක් ඇතුළත් කරන්න (උදා: https://example.com/article)."
        );
        setSpecificError(msg);
        alert(msg);
        return;
      }
    }

    setSpecificError("");
    setSpecificLoading(true);
    setSpecificStatus(tr(
      "Crawling specific page and generating multilingual summary…",
      "குறிப்பிட்ட பக்கத்தை ஊர்ந்து சுருக்கம் உருவாக்குகிறது…",
      "නිශ්චිත පිටුව ක්‍රෝල් කර සාරාංශය ජනනය කරයි…"
    ));

    try {
      const payload = {
        base_url: baseUrl,
        mode: "selected",
        page_number: selectedPageForCrawl?.page_number || null,
        page_url: selectedPageForCrawl?.url || null,
        document_id: doc?.id || null,
      };
      const res = await crawlSpecificPage(payload);
      setSpecificResult(res);
      setSpecificStatus(tr(
        "Specific page successfully crawled!",
        "குறிப்பிட்ட பக்கம் வெற்றிகரமாக ஊரப்பட்டது!",
        "නිශ්චිත පිටුව සාර්ථකව ක්‍රෝල් කරන ලදී!"
      ));
      if (typeof onDocumentUpdated === "function" && doc?.id) {
        onDocumentUpdated(doc.id);
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || "Failed to crawl specific page.";
      setSpecificError(errMsg);
      setSpecificStatus("");
    } finally {
      setSpecificLoading(false);
    }
  };

  const handleClearSpecificResult = () => {
    if (window.confirm(tr(
      "Clear specific crawled page result?",
      "குறிப்பிட்ட பக்க ஊர்தி முடிவை அழிக்கவா?",
      "නිශ්චිත ක්‍රෝල් කළ පිටු ප්‍රතිඵලය මකා දැමිය යුතුද?"
    ))) {
      setSpecificResult(null);
      setSpecificStatus("");
      setSpecificError("");
      if (doc?.id) {
        try {
          localStorage.removeItem(`lrw_specific_crawl_${doc.id}`);
        } catch { }
      }
    }
  };

  const handleSelectAvailablePage = (item) => {
    setSelectedPageForCrawl(item);
    setSpecificError("");
    if (doc?.id) { try { localStorage.setItem(`lrw_selected_page_${doc.id}`, JSON.stringify(item)); } catch {} }


    setCrawlMode("specific");
    setViewMode("crawler");
  };

  const handleViewDocument = (page) => {
    if (typeof onSelectPage === "function") {
      onSelectPage(page);
    } else if (page?.doc_id && page.doc_id !== doc?.id) {
      navigate(`/documents/${page.doc_id}?tab=overview`, { state: { tab: "overview" } });
    } else {
      if (typeof onOpenOverview === "function") {
        onOpenOverview();
      }
    }
  };

  if (viewMode === "available_pages") {
    const filteredItems = discoveredItems.filter((item) => {
      if (!pageSearchFilter.trim()) return true;
      const q = pageSearchFilter.toLowerCase();
      return (
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.url && item.url.toLowerCase().includes(q)) ||
        String(item.page_number) === q
      );
    });

    return (
      <div style={{ padding: "8px 0" }}>
        {/* Navigation & Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setViewMode("crawler")}
            style={{ fontWeight: 600, color: "var(--forest)", border: "1px solid var(--border)" }}
          >
            ← {tr("Back to Web Crawler", "வலை ஊர்திக்குத் திரும்பு", "වෙබ් ක්‍රෝලර් වෙත ආපසු")}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge" style={{ background: "var(--forest)", color: "#fff", fontSize: 13, fontWeight: 700, padding: "5px 12px", borderRadius: 14 }}>
              {tr(`Total Available Pages: ${discoveredItems.length || totalAvailablePages || 0}`, `மொத்த பக்கங்கள்: ${discoveredItems.length || totalAvailablePages || 0}`, `මුළු පවතින පිටු: ${discoveredItems.length || totalAvailablePages || 0}`)}
            </span>
          </div>
        </div>

        {/* Available Pages Card */}
        <div style={{
          background: "var(--paper)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "20px 24px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--forest)" }}>
                {tr("Discovered Available Pages", "கண்டறியப்பட்ட இருக்கக்கூடிய பக்கங்கள்", "සොයාගත් පවතින පිටු")}
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-mid)" }}>
                {tr(
                  "Select a page from the list below to automatically prepare it for specific page crawling.",
                  "குறிப்பிட்ட பக்கத்தை ஊர்வதற்கு கீழேயுள்ள பட்டியலிலிருந்து ஒரு பக்கத்தைத் தேர்ந்தெடுக்கவும்.",
                  "නිශ්චිත පිටුවක් ක්‍රෝල් කිරීම සඳහා පහත ලැයිස්තුවෙන් පිටුවක් තෝරන්න."
                )}
              </p>
            </div>

            {/* Filter Search Input */}
            <div style={{ minWidth: 260 }}>
              <input
                type="text"
                placeholder={tr("Filter by keyword, title, or URL…", "தலைப்பு அல்லது முகவரி மூலம் தேடு…", "මාතෘකාව හෝ URL මගින් සොයන්න…")}
                value={pageSearchFilter}
                onChange={(e) => setPageSearchFilter(e.target.value)}
                style={{
                  width: "100%", padding: "7px 12px", fontSize: 13,
                  borderRadius: 6, border: "1px solid var(--border)",
                  background: "var(--paper)", color: "var(--ink)",
                }}
              />
            </div>
          </div>

          {/* Loading or Empty State */}
          {discovering && discoveredItems.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--ink-mid)" }}>
              <div style={{ fontSize: 18, marginBottom: 8, fontWeight: 600 }}>
                {tr("Scanning website to discover all available pages…", "வலைத்தளத்தின் அனைத்து பக்கங்களையும் கண்டறிகிறது…", "සියලුම පිටු සොයා ගැනීමට වෙබ් අඩවිය ස්කෑන් කරයි…")}
              </div>
              <p style={{ margin: 0, fontSize: 13 }}>
                {tr("Checking sitemaps and exploring internal links. Please wait a moment.", "தளவரைபடங்கள் மற்றும் இணைப்புகளைச் சரிபார்க்கிறது. சிறிது நேரம் காத்திருக்கவும்.", "සයිට්මැප් සහ අභ්‍යන්තර සබැඳි පරීක්ෂා කරමින් පවතී.")}
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: "36px 20px", textAlign: "center", color: "var(--ink-mid)" }}>
              <p style={{ margin: 0, fontSize: 14 }}>
                {pageSearchFilter
                  ? tr("No pages matched your filter.", "வடிகட்டலுக்குப் பொருந்தும் பக்கங்கள் இல்லை.", "ගැලපෙන පිටු කිසිවක් හමු නොවීය.")
                  : tr("No subpages could be discovered for this URL.", "இந்த முகவரிக்கான பக்கங்கள் எதுவும் கண்டறியப்படவில்லை.", "මෙම URL සඳහා උප පිටු කිසිවක් සොයාගත නොහැකි විය.")}
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 12, color: "var(--ink-lt)" }}>
                <span>
                  {tr(
                    `Showing ${filteredItems.length} of ${discoveredItems.length} pages`,
                    `${discoveredItems.length} இல் ${filteredItems.length} பக்கங்கள் காட்டப்படுகின்றன`,
                    `පිටු ${discoveredItems.length} න් ${filteredItems.length} ක් පෙන්වයි`
                  )}
                </span>
              </div>

              {/* Scrollable Pages Table */}
              <div style={{
                maxHeight: "540px",
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                  <thead style={{
                    position: "sticky", top: 0,
                    background: "var(--bg-subtle, #f8fafc)",
                    borderBottom: "1px solid var(--border)",
                    zIndex: 2,
                  }}>
                    <tr>
                      <th style={{ padding: "10px 14px", width: 70, color: "var(--ink-lt)", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                        {tr("Page #", "பக்கம் #", "පිටුව #")}
                      </th>
                      <th style={{ padding: "10px 14px", color: "var(--ink-lt)", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                        {tr("Page Title", "பக்க தலைப்பு", "පිටු මාතෘකාව")}
                      </th>
                      <th style={{ padding: "10px 14px", color: "var(--ink-lt)", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                        {tr("Full URL", "முழு முகவரி", "සම්පූර්ණ URL")}
                      </th>
                      <th style={{ padding: "10px 14px", width: 140, textAlign: "right", color: "var(--ink-lt)", fontWeight: 700, fontSize: 11, textTransform: "uppercase" }}>
                        {tr("Action", "செயல்", "ක්‍රියාව")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr
                        key={`${item.page_number}-${item.url}`}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--forest)" }}>
                          <span className="badge" style={{ background: "var(--mint)", color: "var(--forest)", fontSize: 12, padding: "2px 8px" }}>
                            #{item.page_number}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--ink)" }}>
                          {item.title || item.url}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--forest)", textDecoration: "none", wordBreak: "break-all", fontSize: 12 }}
                            title={item.url}
                          >
                            {item.url} ↗
                          </a>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSelectAvailablePage(item)}
                            style={{ fontSize: 12, padding: "5px 12px" }}
                            title={tr("Select this page to crawl", "ஊர்வதற்கு இந்த பக்கத்தைத் தேர்ந்தெடு", "ක්‍රෝල් කිරීමට මෙම පිටුව තෝරන්න")}
                          >
                            {tr("Select Page", "பக்கத்தைத் தேர்ந்தெடு", "පිටුව තෝරන්න")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const _dummy = () => {
    if (false) {
    } else {
      if (typeof onOpenOverview === "function") {
        onOpenOverview();
      }
    }
  };

  return (
    <div style={{ padding: "8px 0" }}>
      {/* Overview Metric Tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div style={{
          background: "var(--paper)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-lt)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {tr("Total Pages Available", "வலைத்தளத்தின் மொத்த பக்கங்கள்", "වෙබ් අඩවියේ මුළු පිටු")}
          </span>
          <span style={{ fontSize: 30, fontWeight: 800, color: "var(--forest)", lineHeight: 1.1 }}>
            {discovering
              ? tr("Scanning…", "கணக்கிடுகிறது…", "ස්කෑන් වෙමින්…")
              : ((discoveredItems.length || totalAvailablePages) !== null && (discoveredItems.length || totalAvailablePages) !== undefined ? `${discoveredItems.length || totalAvailablePages}` : "—")}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>
            {tr("Pages found under this website", "வலைத்தளத்தின் கீழ் உள்ள பக்கங்கள்", "මෙම වෙබ් අඩවිය යටතේ හමු වූ පිටු")}
          </span>
          <button
            type="button"
            onClick={() => setViewMode("available_pages")}
            style={{
              alignSelf: "flex-start",
              marginTop: 6,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 6,
              display: "none",
              color: "var(--forest, #1a3a2a)",
              border: "1px solid var(--border)",
              cursor: "pointer",
            }}
          >
            {null}
          </button>
          <span style={{ display: "none" }}>
          </span>
        </div>

        <div style={{
          background: "var(--paper)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-lt)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {tr("Pages Crawled", "ஊரப்பட்ட பக்கங்கள்", "ක්‍රෝල් කළ පිටු")}
          </span>
          <span style={{ fontSize: 30, fontWeight: 800, color: "var(--ink)", lineHeight: 1.1 }}>
            {crawlResults.length}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>
            {crawlResults.length === 1
              ? tr("1 page saved in corpus", "1 பக்கம் தரவில் உள்ளது", "පිටු 1ක් සුරකින ලදි")
              : tr(`${crawlResults.length} pages saved in corpus`, `${crawlResults.length} பக்கங்கள் தரவில் உள்ளன`, `පිටු ${crawlResults.length}ක් සුරකින ලදි`)}
          </span>
        </div>

        <div style={{
          background: "var(--paper)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-lt)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {tr("Crawler Status", "ஊர்தி நிலை", "ක්‍රෝලර් තත්ත්වය")}
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: crawling ? "#d97706" : (crawlResults.length > 0 ? "var(--forest)" : "var(--ink-mid)") }}>
            {crawling ? tr("Crawling…", "ஊர்கிறது…", "ක්‍රෝල් වෙමින්…") : (crawlResults.length > 0 ? tr("Crawled", "ஊரப்பட்டது", "ක්‍රෝල් කරන ලදි") : tr("Ready", "தயார்", "සූදානම්"))}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>
            {crawlResults.length > 0
              ? tr(`${crawlResults.length} pages ready to view`, `${crawlResults.length} பக்கங்கள் தயார்`, `පිටු ${crawlResults.length}ක් සූදානම්`)
              : tr("Ready to crawl", "ஊரத் தயார்", "ක්‍රෝල් කිරීමට සූදානම්")}
          </span>
        </div>
      </div>

      {/* Control Card */}
      <div style={{
        background: "var(--paper)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "20px 24px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--forest)" }}>
                {tr("Web Crawler", "வலை ஊர்தி", "වෙබ් ක්‍රෝලර්")}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mid)" }}>
              {tr(
                "Discover links, crawl permitted pages within this domain, and extract readable text with summaries.",
                "இணையதளத்தின் இணைப்புகளைக் கண்டறிந்து, அனுமதிக்கப்பட்ட பக்கங்களை ஊர்ந்து உரை மற்றும் சுருக்கத்தைப் பெறவும்.",
                "මෙම ඩොමේනය තුළ සබැඳි සොයාගෙන, අවසර ලත් පිටු ක්‍රෝල් කර සාරාංශ සහිත පෙළ ලබා ගන්න."
              )}
            </p>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setViewMode("available_pages")}
            style={{ color: "var(--forest)", fontSize: 12, padding: "5px 12px", fontWeight: 600, border: "1px solid var(--border)", borderRadius: 6 }}
            title={tr("View all discoverable pages", "அனைத்துப் பக்கங்களையும் பார்", "සියලුම පිටු බලන්න")}
          >
            📄 {tr("View Available Pages", "இருக்கக்கூடிய பக்கங்கள்", "පවතින පිටු බලන්න")}
          </button>

          {crawlMode === "multiple" && crawlResults.length > 0 && !crawling && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleClearResults}
              style={{ color: "var(--danger)", fontSize: 12, padding: "4px 10px" }}
              title={tr("Clear saved results", "முடிவுகளை அழி", "ප්‍රතිඵල මකන්න")}
            >
              {tr("Clear History", "வரலாற்றை அழி", "ඉතිහාසය මකන්න")}
            </button>
          )}
        </div>

        {/* Crawling Mode Switcher */}
        <div style={{
          display: "inline-flex",
          background: "var(--bg-subtle, #f1f5f9)",
          padding: 4,
          borderRadius: 8,
          border: "1px solid var(--border)",
          marginTop: 14,
          marginBottom: 16,
          gap: 4,
        }}>
          <button
            type="button"
            onClick={() => setCrawlMode("multiple")}
            style={{
              padding: "7px 18px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: crawlMode === "multiple" ? "var(--forest, #1a3a2a)" : "transparent",
              color: crawlMode === "multiple" ? "#ffffff" : "var(--ink-mid)",
              boxShadow: crawlMode === "multiple" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {tr("Crawl Multiple Pages", "பல பக்கங்களை ஊர்க", "බහු පිටු ක්‍රෝල් කරන්න")}
          </button>
          <button
            type="button"
            onClick={() => setCrawlMode("specific")}
            style={{
              padding: "7px 18px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
              background: crawlMode === "specific" ? "var(--forest, #1a3a2a)" : "transparent",
              color: crawlMode === "specific" ? "#ffffff" : "var(--ink-mid)",
              boxShadow: crawlMode === "specific" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
          >
            {tr("Crawl Specific Page", "குறிப்பிட்ட பக்கத்தை ஊர்க", "නිශ්චිත පිටුවක් ක්‍රෝල් කරන්න")}
          </button>
        </div>

        {/* Mode 1: Multiple Pages Crawling */}
        {crawlMode === "multiple" && (
          <>
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-lt)", display: "block", marginBottom: 4 }}>
              {tr("Target URL", "இலக்கு முகவரி", "ඉලක්කගත URL")}
            </span>
            <input
              type="url"
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={crawling}
              style={{
                width: "100%", padding: "7px 12px", fontSize: 13,
                borderRadius: 6, border: "1px solid var(--border)",
                background: "var(--paper)", color: "var(--ink)",
              }}
            />
          </div>

          <div style={{ minWidth: 200 }}>
            <div style={{ marginBottom: 4 }}>
              <label htmlFor="crawler-pages-input" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-lt)", margin: 0 }}>
                {tr("Pages to crawl", "பக்கங்களின் எண்ணிக்கை", "ක්‍රෝල් කිරීමට පිටු")}
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="crawler-pages-input"
                type="number"
                min={1}
                max={totalAvailablePages || undefined}
                value={crawlMaxPages}
                onChange={(e) => setCrawlMaxPages(Math.max(1, Number(e.target.value)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleStartCrawlClick(e);
                  }
                }}
                disabled={crawling}
                style={{ width: 100, padding: "7px 10px", fontSize: 14, textAlign: "center", borderRadius: 6, border: "1px solid var(--border)" }}
              />
            </div>
          </div>

          <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartCrawlClick}
              disabled={crawling}
              style={{ padding: "9px 20px", fontSize: 14, minWidth: 140 }}
            >
              {crawling
                ? tr("Crawling…", "ஊர்கிறது…", "ක්‍රෝල් වෙමින්…")
                : tr("Start Crawling", "ஊரத் தொடங்கு", "ක්‍රෝල් කිරීම අරඹන්න")}
            </button>
          </div>
        </div>

        {crawlStatus && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginTop: 16, padding: "10px 14px", borderRadius: 8,
            background: "var(--mint)", fontSize: 13, color: "var(--forest)", fontWeight: 600,
          }}>
            {crawlStatus}
          </div>
        )}

        {crawlError && (
          <div className="alert-error" style={{ marginTop: 16 }}>
            {crawlError}
          </div>
        )}
      </>
    )}

    {/* Mode 2: Specific Page Crawling */}
    {crawlMode === "specific" && (
      <div>
        {!selectedPageForCrawl ? (
          <div style={{
            background: "var(--bg-subtle, #f8fafc)",
            border: "1px dashed var(--border)",
            borderRadius: 8,
            padding: "20px 24px",
            textAlign: "center",
          }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink-mid)" }}>
              {tr(
                "No page selected yet. Choose a specific page from the available pages list to crawl.",
                "பக்கம் எதுவும் தேர்ந்தெடுக்கப்படவில்லை. ஊர்வதற்கு இருக்கக்கூடிய பக்கங்களின் பட்டியலிலிருந்து ஒரு பக்கத்தைத் தேர்ந்தெடுக்கவும்.",
                "තවමත් පිටුවක් තෝරා නැත. ක්‍රෝල් කිරීම සඳහා පවතින පිටු ලැයිස්තුවෙන් පිටුවක් තෝරන්න."
              )}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setViewMode("available_pages")}
              style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600 }}
            >
              📄 {tr("Select Page from Available Pages", "இருக்கக்கூடிய பக்கங்களிலிருந்து தேர்ந்தெடுக்கவும்", "පවතින පිටු වලින් පිටුවක් තෝරන්න")}
            </button>
          </div>
        ) : (
          <div style={{
            background: "var(--bg-subtle, #f8fafc)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "16px 20px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-lt)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {tr("Selected Page to Crawl", "ஊர்வதற்குத் தேர்ந்தெடுக்கப்பட்ட பக்கம்", "ක්‍රෝල් කිරීමට තෝරාගත් පිටුව")}
                  </span>
                  {selectedPageForCrawl.page_number && (
                    <span className="badge" style={{ background: "var(--mint)", color: "var(--forest)", fontWeight: 700, fontSize: 12, padding: "2px 8px" }}>
                      #{selectedPageForCrawl.page_number}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                  {selectedPageForCrawl.title || selectedPageForCrawl.url}
                </div>
                <a
                  href={selectedPageForCrawl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: "var(--forest)", textDecoration: "none", wordBreak: "break-all" }}
                >
                  {selectedPageForCrawl.url} ↗
                </a>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setViewMode("available_pages")}
                  disabled={specificLoading}
                  style={{ color: "var(--forest)", fontSize: 12, border: "1px solid var(--border)", padding: "6px 14px", fontWeight: 600 }}
                  title={tr("Choose a different page from available pages", "வேறு பக்கத்தைத் தேர்ந்தெடுக்கவும்", "වෙනත් පිටුවක් තෝරන්න")}
                >
                  {tr("Change Page", "பக்கத்தை மாற்று", "පිටුව වෙනස් කරන්න")}
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={executeSpecificCrawl}
                  disabled={specificLoading}
                  style={{ padding: "8px 22px", fontSize: 14, minWidth: 140 }}
                >
                  {specificLoading
                    ? tr("Crawling…", "ஊர்கிறது…", "ක්‍රෝල් වෙමින්…")
                    : tr("Start Crawling", "ஊரத் தொடங்கு", "ක්‍රෝල් කිරීම අරඹන්න")}
                </button>
              </div>
            </div>
          </div>
        )}
        <div style={{ display: "none" }}>
        <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            <input
              type="radio"
              name="specificCrawlOption"
              value="page_number"
              checked={specificType === "page_number"}
              onChange={() => { setSpecificType("page_number"); setSpecificError(""); }}
              disabled={specificLoading}
              style={{ accentColor: "var(--forest)", cursor: "pointer" }}
            />
            <span>{tr("Crawl by Page Number", "பக்க எண் மூலம் ஊர்க", "පිටු අංකය මගින් ක්‍රෝල් කරන්න")}</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
            <input
              type="radio"
              name="specificCrawlOption"
              value="page_url"
              checked={specificType === "page_url"}
              onChange={() => { setSpecificType("page_url"); setSpecificError(""); }}
              disabled={specificLoading}
              style={{ accentColor: "var(--forest)", cursor: "pointer" }}
            />
            <span>{tr("Crawl by Page URL", "பக்க முகவரி மூலம் ஊர்க", "පිටු URL මගින් ක්‍රෝල් කරන්න")}</span>
          </label>
        </div>

        {specificType === "page_number" ? (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label htmlFor="specific-page-number" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-lt)", margin: 0 }}>
                  {tr("Enter Page Number", "பக்க எண்ணை உள்ளிடவும்", "පිටු අංකය ඇතුළත් කරන්න")}
                  {totalAvailablePages ? ` (1 – ${totalAvailablePages})` : ""}
                </label>
                <button
                  type="button"
                  onClick={() => setViewMode("available_pages")}
                  style={{
                    background: "none", border: "none", padding: 0,
                    color: "var(--forest)", fontSize: 11, fontWeight: 600,
                    cursor: "pointer", textDecoration: "underline",
                  }}
                  title={tr("Browse and select from available pages", "இருக்கக்கூடிய பக்கங்களை உலாவவும்", "පවතින පිටු පිරික්සන්න")}
                >
                  {tr("View Available Pages", "பக்கங்களைப் பார்", "පිටු ලැයිස්තුව")}
                </button>
              </div>
              <label style={{ display: "none" }}>
                {tr("Enter Page Number", "பக்க எண்ணை உள்ளிடவும்", "පිටු අංකය ඇතුළත් කරන්න")}
                {totalAvailablePages ? ` (1 – ${totalAvailablePages})` : ""}
              </label>
              <input
                id="specific-page-number"
                type="number"
                min={1}
                max={totalAvailablePages || undefined}
                value={specificPageNumber}
                onChange={(e) => setSpecificPageNumber(Math.max(1, Number(e.target.value)))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    executeSpecificCrawl();
                  }
                }}
                disabled={specificLoading}
                placeholder="1"
                style={{
                  width: 140, padding: "8px 12px", fontSize: 14, textAlign: "center",
                  borderRadius: 6, border: "1px solid var(--border)",
                  background: "var(--paper)", color: "var(--ink)",
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={executeSpecificCrawl}
              disabled={specificLoading}
              style={{ padding: "9px 22px", fontSize: 14, minWidth: 140 }}
            >
              {specificLoading
                ? tr("Crawling…", "ஊர்கிறது…", "ක්‍රෝල් වෙමින්…")
                : tr("Start Crawling", "ஊரத் தொடங்கு", "ක්‍රෝල් කිරීම අරඹන්න")}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label htmlFor="specific-page-url" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-lt)", margin: 0 }}>
                  {tr("Enter Specific Page URL", "குறிப்பிட்ட பக்க முகவரியை உள்ளிடவும்", "නිශ්චිත පිටු URL ඇතුළත් කරන්න")}
                </label>
                <button
                  type="button"
                  onClick={() => setViewMode("available_pages")}
                  style={{
                    background: "none", border: "none", padding: 0,
                    color: "var(--forest)", fontSize: 11, fontWeight: 600,
                    cursor: "pointer", textDecoration: "underline",
                  }}
                  title={tr("Browse and select from available pages", "இருக்கக்கூடிய பக்கங்களை உலாவவும்", "පවතින පිටු පිරික්සන්න")}
                >
                  {tr("View Available Pages", "பக்கங்களைப் பார்", "පිටු ලැයිස්තුව")}
                </button>
              </div>
              <label style={{ display: "none" }}>
                {tr("Enter Specific Page URL", "குறிப்பிட்ட பக்க முகவரியை உள்ளிடவும்", "නිශ්චිත පිටු URL ඇතුළත් කරන්න")}
              </label>
              <input
                id="specific-page-url"
                type="url"
                value={specificPageUrl}
                onChange={(e) => setSpecificPageUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    executeSpecificCrawl();
                  }
                }}
                disabled={specificLoading}
                placeholder={currentUrl ? `${currentUrl.replace(/\/+$/, "")}/article-example` : "https://example.com/page"}
                style={{
                  width: "100%", padding: "8px 12px", fontSize: 13,
                  borderRadius: 6, border: "1px solid var(--border)",
                  background: "var(--paper)", color: "var(--ink)",
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={executeSpecificCrawl}
              disabled={specificLoading}
              style={{ padding: "9px 22px", fontSize: 14, minWidth: 140 }}
            >
              {specificLoading
                ? tr("Crawling…", "ஊர்கிறது…", "ක්‍රෝල් වෙමින්…")
                : tr("Start Crawling", "ஊரத் தொடங்கு", "ක්‍රෝල් කිරීම අරඹන්න")}
            </button>
          </div>
        )}

        </div>
        {specificStatus && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginTop: 16, padding: "10px 14px", borderRadius: 8,
            background: "var(--mint)", fontSize: 13, color: "var(--forest)", fontWeight: 600,
          }}>
            {specificStatus}
          </div>
        )}

        {specificError && (
          <div className="alert-error" style={{ marginTop: 16 }}>
            {specificError}
          </div>
        )}
      </div>
    )}
    {false && crawlError && (
          <div className="alert-error" style={{ marginTop: 16 }}>
            {crawlError}
          </div>
        )}
      </div>

      {/* Crawled Results */}
      {/* Specific Page Crawl Result */}
      {crawlMode === "specific" && specificResult && (
        <div style={{
          background: "var(--paper)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 20,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-lt)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {tr("Specific Page Crawl Result", "குறிப்பிட்ட பக்க ஊர்தி முடிவு", "නිශ්චිත පිටු ක්‍රෝලර් ප්‍රතිඵලය")}
                </span>
                {specificResult.page_number && (
                  <span className="badge" style={{ background: "var(--mint)", color: "var(--forest)", fontWeight: 700, fontSize: 12, padding: "2px 8px" }}>
                    {tr(`Page #${specificResult.page_number}`, `பக்கம் #${specificResult.page_number}`, `පිටුව #${specificResult.page_number}`)}
                  </span>
                )}
              </div>
              <h3 style={{ margin: "4px 0 8px", fontSize: 18, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>
                {specificResult.page_title || specificResult.page_url}
              </h3>
              <a
                href={specificResult.page_url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 13, color: "var(--forest)", textDecoration: "none", wordBreak: "break-all" }}
              >
                {specificResult.page_url} ↗
              </a>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleViewDocument({
                  doc_id: specificResult.doc_id,
                  url: specificResult.page_url,
                  text: specificResult.raw_text || specificResult.text,
                  summary: specificResult.summary,
                  title: specificResult.page_title,
                })}
                style={{ padding: "8px 18px", fontSize: 13, fontWeight: 600 }}
              >
                {tr("View Document", "ஆவணத்தைப் பார்", "ලේඛනය බලන්න")}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleClearSpecificResult}
                style={{ color: "var(--danger)", fontSize: 12 }}
                title={tr("Clear result", "முடிவை அழி", "ප්‍රතිඵලය මකන්න")}
              >
                {tr("Clear", "அழி", "මකන්න")}
              </button>
            </div>
          </div>

          <div style={{
            marginTop: 16,
            background: "var(--bg-subtle, #f8fafc)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "16px 18px",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--forest)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {tr("Extracted Content Summary", "பிரித்தெடுக்கப்பட்ட உள்ளடக்கச் சுருக்கம்", "උපුටාගත් අන්තර්ගත සාරාංශය")}
            </div>
            <p style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--ink)",
              whiteSpace: "pre-wrap",
            }}>
              {specificResult.summary || tr("No summary generated.", "சுருக்கம் இல்லை.", "සාරාංශයක් නොමැත.")}
            </p>
          </div>
        </div>
      )}

      {/* Crawled Results */}
      {crawlMode === "multiple" && crawlResults.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", display: "flex", alignItems: "center", gap: 10 }}>
              <span>{tr("Discovered Pages & Summaries", "கண்டறியப்பட்ட பக்கங்கள் மற்றும் சுருக்கம்", "සොයාගත් පිටු සහ සාරාංශ")}</span>
              <span className="badge" style={{ background: "var(--forest)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 12 }}>
                {tr(`Total Pages: ${crawlResults.length}`, `மொத்த பக்கங்கள்: ${crawlResults.length}`, `මුළු පිටු: ${crawlResults.length}`)}
              </span>
            </div>
            <span style={{ fontSize: 12, color: "var(--ink-lt)" }}>
              {tr("Saved automatically", "தானாக சேமிக்கப்பட்டது", "ස්වයංක්‍රීයව සුරකින ලදි")}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {crawlResults.map((page, idx) => {
              const isCurrentDoc = page.doc_id === doc.id || page.url === doc.filename;

              return (
                <div
                  key={idx}
                  style={{
                    background: "var(--paper)", border: "1px solid var(--border)",
                    borderRadius: 10, padding: "14px 18px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 14, fontWeight: 600, color: "var(--forest)", wordBreak: "break-all" }}
                    >
                      {page.url}
                    </a>
                    {isCurrentDoc && (
                      <span className="badge" style={{ background: "var(--mint)", color: "var(--forest)", fontSize: 11 }}>
                        {tr("Current Document", "தற்போதைய ஆவணம்", "වත්මන් ලේඛනය")}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginTop: 6 }}>
                    <div style={{
                      flex: 1, minWidth: 0,
                      background: "var(--mint)", padding: "10px 14px",
                      borderRadius: 8, border: "1px solid var(--border)",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--forest)", marginBottom: 4, textTransform: "uppercase" }}>
                        {tr("Summary", "சுருக்கம்", "සාරාංශය")}
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--ink)", wordBreak: "break-word" }}>
                        {page.summary || (page.text ? page.text.slice(0, 220) + "…" : tr("No summary available.", "சுருக்கம் இல்லை.", "සාරාංශයක් නොමැත."))}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0, whiteSpace: "nowrap", padding: "8px 16px" }}
                      onClick={() => handleViewDocument(page)}
                    >
                      {tr("View Document", "ஆவணத்தைப் பார்", "ලේඛනය බලන්න")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
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

// Manual correction of extracted/cleaned text. The original raw text remains unchanged.
function CleanedTextTab({ docId, text, tr, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text || "");
  const [reanalyze, setReanalyze] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const original = text || "";
  const hasChanges = draft !== original;

  const cancelEdit = () => {
    setDraft(original);
    setReanalyze(false);
    setEditing(false);
    setMessage(null);
  };

  const saveChanges = async (event) => {
    event.preventDefault();
    if (saving || !hasChanges) return;
    if (!draft.trim()) {
      setMessage({ type: "error", text: tr(
        "Cleaned text cannot be empty.",
        "சுத்திகரிக்கப்பட்ட உரை காலியாக இருக்க முடியாது.",
        "පිරිසිදු කළ පෙළ හිස් විය නොහැක."
      ) });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const result = await updateDocumentCleanedText(docId, {
        cleaned_text: draft,
        reanalyze,
      });
      const newText = result?.cleaned_text ?? draft;
      onSaved(newText, reanalyze ? (result?.nlp ?? null) : null);
      setDraft(newText);
      setEditing(false);
      setMessage({
        type: "success",
        text: reanalyze
          ? tr(
              "Cleaned text saved and NLP results regenerated.",
              "சுத்திகரிக்கப்பட்ட உரை சேமிக்கப்பட்டது; NLP முடிவுகள் மீண்டும் உருவாக்கப்பட்டன.",
              "පිරිසිදු කළ පෙළ සුරකින ලදි; NLP ප්‍රතිඵල නැවත ගණනය කරන ලදි."
            )
          : tr(
              "Cleaned text saved. Existing NLP results have not changed.",
              "சுத்திகரிக்கப்பட்ட உரை சேமிக்கப்பட்டது. பழைய NLP முடிவுகள் மாற்றப்படவில்லை.",
              "පිරිසිදු කළ පෙළ සුරකින ලදි. පැරණි NLP ප්‍රතිඵල වෙනස් නොවීය."
            ),
      });
      setReanalyze(false);
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, tr(
          "Unable to save cleaned text. Check the backend API.",
          "உரையைச் சேமிக்க முடியவில்லை. Backend API-ஐச் சரிபார்க்கவும்.",
          "පෙළ සුරැකීමට නොහැකි විය. Backend API පරීක්ෂා කරන්න."
        )),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 14,
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: "var(--forest)" }}>
            {tr("Cleaned Text", "சுத்திகரிக்கப்பட்ட உரை", "පිරිසිදු කළ පෙළ")}
          </h3>
          <span className="muted" style={{ fontSize: 12 }}>
            {draft.length.toLocaleString()} {tr("characters", "எழுத்துகள்", "අක්ෂර")}
          </span>
        </div>
        {!editing && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setDraft(original);
              setReanalyze(false);
              setMessage(null);
              setEditing(true);
            }}
          >
            {tr("Edit Cleaned Text", "உரையைத் திருத்து", "පිරිසිදු කළ පෙළ සංස්කරණය")}
          </button>
        )}
      </div>

      {message && (
        <div
          role="status"
          className={message.type === "error" ? "alert-error" : "alert-success"}
          style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8 }}
        >
          {message.text}
        </div>
      )}

      {editing ? (
        <form onSubmit={saveChanges}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            aria-label={tr("Edit cleaned text", "சுத்திகரிக்கப்பட்ட உரையைத் திருத்து", "පිරිසිදු කළ පෙළ සංස්කරණය")}
            spellCheck={false}
            style={{
              width: "100%", minHeight: 360, padding: 16, borderRadius: 9,
              border: "1px solid var(--border)", background: "var(--paper)",
              color: "var(--ink)", fontSize: 14, lineHeight: 1.8,
              fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
            }}
          />
          <label style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 12, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={reanalyze}
              disabled={saving}
              onChange={(e) => setReanalyze(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              {tr(
                "Re-run NLP analysis after saving (replaces existing POS, lemma and morphology edits)",
                "சேமித்த பிறகு NLP பகுப்பாய்வை மீண்டும் இயக்கு (ஏற்கனவே திருத்திய POS, வேர்ச்சொல், உருபியல் அம்சங்கள் மாற்றப்படும்)",
                "සුරැකීමෙන් පසු NLP විශ්ලේෂණය නැවත කරන්න (පවතින POS, lemma සහ morphology සංස්කරණ ප්‍රතිස්ථාපනය වේ)"
              )}
            </span>
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={saving || !hasChanges || !draft.trim()}>
              {saving ? tr("Saving...", "சேமிக்கிறது...", "සුරකිමින්...") : tr("Save Changes", "மாற்றங்களைச் சேமி", "වෙනස්කම් සුරකින්න")}
            </button>
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={cancelEdit}>
              {tr("Cancel", "ரத்துசெய்", "අවලංගු කරන්න")}
            </button>
          </div>
        </form>
      ) : (
        <pre className="snippet" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {original || tr("No cleaned text available.", "சுத்திகரிக்கப்பட்ட உரை இல்லை.", "පිරිසිදු කළ පෙළ නොමැත.")}
        </pre>
      )}
    </div>
  );
}

export default function DocumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [doc, setDoc] = useState(null);
  const [selectedSubpageDoc, setSelectedSubpageDoc] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [appLang, setAppLang] = useState(() => localStorage.getItem("lrw_lang") || "");

  const refreshDocument = useCallback(async (docId = id) => {
    try {
      const data = await getDocument(docId);
      setDoc(data);
    } catch { }
  }, [id]);

  const handleSelectPage = useCallback(async (page) => {
    if (!page) return;
    if (page.doc_id === doc?.id || page.url === doc?.filename) {
      setSelectedSubpageDoc(null);
      setTab("overview");
      return;
    }

    const previewDoc = {
      id: page.doc_id,
      filename: page.url,
      file_type: "url",
      raw_text: page.text,
      cleaned_text: page.text,
      summary: page.summary,
      created_at: doc?.created_at,
      is_crawled_subpage: true,
      parent_document_id: doc?.id,
      metadata: { source: "crawler", crawled_url: page.url, title: page.title },
      title: page.title,
      nlp: null,
    };
    setSelectedSubpageDoc(previewDoc);
    setTab("overview");

    if (page.doc_id) {
      try {
        const fullDoc = await getDocument(page.doc_id);
        if (fullDoc) {
          setSelectedSubpageDoc(fullDoc);
        }
      } catch (err) {
        console.warn("Could not load full subpage document, using preview:", err);
      }
    }
  }, [doc]);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setSelectedSubpageDoc(null);
    setError("");
    setLoading(true);

    getDocument(id)
      .then((data) => {
        if (!cancelled) {
          setDoc(data);
          setLoading(false);
          const requestedTab = location.state?.tab || new URLSearchParams(window.location.search).get("tab");
          if (requestedTab) {
            setTab(requestedTab);
          } else {
            setTab(data.file_type === "url" ? "crawler" : "overview");
          }
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoading(false);
          setError(getErrorMessage(e, "Failed to load document."));
        }
      });

    return () => { cancelled = true; };
  }, [id, location.state]);

  useEffect(() => {
    const handleLang = (e) => setAppLang(e.detail);
    window.addEventListener("lrw_lang_changed", handleLang);
    return () => window.removeEventListener("lrw_lang_changed", handleLang);
  }, []);

  if (loading) return <div className="page" style={{ paddingTop: 32 }}><p className="muted">Loading document…</p></div>;
  if (error) {
    return (
      <div className="page" style={{ maxWidth: 720, paddingTop: 32 }}>
        <div className="alert-error">{error}</div>
        <Link to="/" className="btn btn-ghost btn-sm">← Back to dashboard</Link>
      </div>
    );
  }
  if (!doc) return <div className="page" style={{ paddingTop: 32 }}><p className="muted">Loading…</p></div>;

  const displayDoc = selectedSubpageDoc || doc;
  const nlp = displayDoc.nlp || {};
  const lang = appLang || nlp.language || "English";
  const tr = makeTr(lang);
  const baseName = displayDoc.filename?.replace(/\.[^.]+$/, "") || "document";
  const isUrlDoc = doc.file_type === "url" || displayDoc.file_type === "url";

  const tabs = [
    ...(isUrlDoc ? [{ key: "crawler", label: tr("Web Crawler", "வலை ஊர்தி", "වෙබ් ක්‍රෝලර්") }] : []),
    { key: "overview", label: tr("Overview", "கண்ணோட்டம்", "දළ විශ්ලේෂණය") },
    { key: "raw", label: tr("Raw Text", "அசல் உரை", "මුල් පෙළ") },
    { key: "cleaned", label: tr("Cleaned Text", "சுத்திகரிக்கப்பட்ட உரை", "පිරිසිදු කළ පෙළ") },
    ...(displayDoc.nlp ? [{ key: "nlp", label: tr("NLP Data", "NLP தரவு", "NLP දත්ත") }] : []),
    { key: "metadata", label: tr("Meta Data", "மெட்டாடேட்டா", "පාරදත්ත") },
  ];

  return (
    <div className="page" style={{ paddingTop: 28 }}>
      <div className="page-header fade-up" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <Link to="/" className="muted" style={{ fontSize: 13, display: "inline-block" }}>
                ← {tr("Dashboard", "முகப்பு", "පුවරුව")}
              </Link>
              {doc.parent_document_id && (
                <Link
                  to={`/documents/${doc.parent_document_id}?tab=crawler`}
                  style={{ fontSize: 13, display: "inline-block", color: "var(--forest)", fontWeight: 600, textDecoration: "none" }}
                >
                  ← {tr("Back to Web Crawler", "வலை ஊர்திக்குத் திரும்பு", "වෙබ් ක්‍රෝලර් වෙත ආපසු")}
                </Link>
              )}
            </div>
            <h1 className="page-title" style={{ wordBreak: "break-word", fontSize: 28, margin: "4px 0 10px" }}>{displayDoc.filename}</h1>
            <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="badge">{displayDoc.file_type}</span>
              {displayDoc.file_type === "pdf" && <PdfTypeBadge pdfType={displayDoc.pdf_type} />}
              {nlp.language && (
                <span className="badge" style={{ background: "var(--mint)", color: "var(--forest)", fontWeight: 600 }}>
                  {nlp.language_display || nlp.language}
                </span>
              )}
              <span className="muted">{formatDate(displayDoc.created_at)}</span>
              {nlp.token_count != null && <span className="muted">{nlp.token_count.toLocaleString()} tokens</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 4 }}>
            {["json", "csv"].map((format) => (
              <button
                key={format}
                className="btn btn-ghost btn-sm"
                type="button"
                title={`Download ${format.toUpperCase()} format`}
                onClick={() => exportDocument(displayDoc.id || id, format, baseName)}
              >
                📥 {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card fade-up fade-up-1">
        {selectedSubpageDoc && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            background: "var(--mint)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--forest)", fontWeight: 600, flex: 1, minWidth: 200 }}>
              <span>📄</span>
              <span>{tr("Viewing crawled subpage:", "பார்வையிடும் ஊரப்பட்ட பக்கம்:", "නරඹන උප පිටුව:")}</span>
              <span style={{ color: "var(--ink)", fontWeight: 500, wordBreak: "break-all" }}>{selectedSubpageDoc.filename}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSelectedSubpageDoc(null);
                  setTab("overview");
                }}
                style={{ fontSize: 12, padding: "4px 10px" }}
              >
                {tr("View Main Document", "முக்கிய ஆவணத்தைப் பார்", "ප්‍රධාන ලේඛනය බලන්න")}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setTab("crawler")}
                style={{ fontSize: 12, padding: "4px 12px" }}
              >
                {tr("Back to Crawler", "ஊர்திக்குத் திரும்பு", "ක්‍රෝලර් වෙත ආපසු")}
              </button>
            </div>
          </div>
        )}

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

        <div style={{ display: tab === "crawler" && isUrlDoc ? "block" : "none" }}>
          {isUrlDoc && (
            <WebCrawlerTab
              key={doc.id}
              doc={doc}
              tr={tr}
              currentTab={tab}
              onOpenOverview={() => {
                setSelectedSubpageDoc(null);
                setTab("overview");
              }}
              onSelectPage={handleSelectPage}
              onDocumentUpdated={refreshDocument}
            />
          )}
        </div>
        {tab === "overview" && <OverviewTab doc={displayDoc} nlp={nlp} tr={tr} />}
        {tab === "raw" && <pre className="snippet">{displayDoc.raw_text || "No raw text available."}</pre>}
        {tab === "cleaned" && (
          <CleanedTextTab
            key={displayDoc.id || id}
            docId={displayDoc.id || id}
            text={displayDoc.cleaned_text || ""}
            tr={tr}
            onSaved={(cleanedText, updatedNlp) => {
              if (selectedSubpageDoc) {
                setSelectedSubpageDoc((prev) => ({
                  ...prev,
                  cleaned_text: cleanedText,
                  ...(updatedNlp ? { nlp: updatedNlp } : {}),
                }));
              } else {
                setDoc((prev) => ({
                  ...prev,
                  cleaned_text: cleanedText,
                  ...(updatedNlp ? { nlp: updatedNlp } : {}),
                }));
              }
            }}
          />
        )}
        {tab === "nlp" && displayDoc.nlp && (
          <NlpTab
            docId={displayDoc.id || id}
            nlp={nlp}
            lang={lang}
            tr={tr}
            onNlpUpdated={(newNlp) => {
              if (selectedSubpageDoc) {
                setSelectedSubpageDoc((prev) => ({ ...prev, nlp: newNlp }));
              } else {
                setDoc((prev) => ({ ...prev, nlp: newNlp }));
              }
            }}
          />
        )}
        {tab === "metadata" && (
          <MetadataTab
            docId={displayDoc.id || id}
            metadata={displayDoc.metadata}
            tr={tr}
            onSaved={(metadata) => {
              if (selectedSubpageDoc) {
                setSelectedSubpageDoc((prev) => ({ ...prev, metadata }));
              } else {
                setDoc((prev) => ({ ...prev, metadata }));
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
