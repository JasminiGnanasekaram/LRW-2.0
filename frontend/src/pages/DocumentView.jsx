import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { getDocument, exportDocument, updateDocumentMetadata, updateDocumentNlp } from "../api";

const PIE_COLORS = ["#1a3a2a", "#4a7c59", "#8fb89a", "#d4e8d0", "#2d5a3d", "#6aaa80", "#b0d8b8", "#386641"];

const NLP_SECTIONS = [
  {
    key: "tokens",
    label: { English: "Tokenization", Tamil: "சொல் பிரித்தல்", Sinhala: "ටෝකනීකරණය" },
    desc: {
      English: "Segments the text into individual normalized word tokens.",
      Tamil: "சொல் பிரித்தல் என்பது ஒரு தொடரில் அல்லது வாக்கியத்தில் உள்ள சொற்களை அவற்றின் பொருள் மாறாமலும், இலக்கண முறைப்படியும் தனித்தனிச் சொற்களாகப் பிரிப்பதைக் குறிக்கும்.",
      Sinhala: "පෙළ ප්‍රමිතිගත තනි වචන ටෝකන බවට වෙන් කරයි.",
    },
  },
  {
    key: "sentences",
    label: { English: "Sentences", Tamil: "வாக்கியங்கள்", Sinhala: "වාක්‍ය" },
    desc: {
      English: "Multilingual sentence segmentation handling punctuation, abbreviations, and decimal numbers.",
      Tamil: "வாக்கியம் என்பது இலக்கண விதிகளுக்குட்பட்டு ஒன்றுக்கு மேற்பட்ட சொற்கள் இணைந்து முழுமையான பொருளைத் தருவதாகும்.",
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
      Tamil: "வேர்ச்சொல் என்பது ஒரு மொழியில் மேலும் பிரிக்க இயலாத, பிற சொற்கள் உருவாகக் காரணமாக அமையும் அடிப்படையான மூலச்சொல் ஆகும்.",
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
      Tamil: "வரைபடங்கள் என்பது தரவுப் புள்ளிகள் மற்றும் அவற்றுக்கு இடையேயான தொடர்புகளை காட்டும் ஒரு கட்டமைப்பாகும்.",
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
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
  if (!isOpen || !token) return null;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [pos, setPos] = useState(token.pos || "X");
  const [lemma, setLemma] = useState(token.lemma || tokenText(token));
  const [morph, setMorph] = useState(token.morph || "");
  const [applyAll, setApplyAll] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setActiveTab(initialTab);
    setPos(token.pos || "X");
    setLemma(token.lemma || tokenText(token));
    setMorph(token.morph || "");
    setApplyAll(true);
    setError(null);
  }, [token, initialTab]);

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
                {tr("Edit NLP Annotation", "NLP தரவைத் திருத்து", "NLP විවරණය සංස්කරණය")}
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
                {tr("Base Dictionary Form (Lemma):", "வேர்ச்சொல் வடிவம் (Lemma):", "මූලික ශබ්දකෝෂ ස්වරූපය (Lemma):")}
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

  const rows = filtered.slice(0, 200).map((tk) => {
    const info = getPosInfo(tk.pos);
    return [
      <strong>{tokenText(tk)}</strong>,
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", borderRadius: 4,
        background: info.bg, color: info.color, border: `1px solid ${info.border}`, fontSize: 11, fontWeight: 600,
      }}>
        {tk.pos || "X"}
      </span>,
      <span style={{ color: "var(--forest)", fontWeight: 500, fontSize: 12 }}>{tk.lemma || tokenText(tk)}</span>,
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
        {tr("Edit", "திருத்து", "සංස්කරණය")}
      </button>,
    ];
  });

  return (
    <div>
      <SectionDesc desc={desc} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--ink-lt)" }}>
          {tr("Showing", "காட்டப்படுகிறது", "පෙන්වන්නේ")}: <strong>{Math.min(filtered.length, 200)}</strong> / {allTokens.length}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Search token...", "சொல்லைத் தேடுங்கள்...", "ටෝකනය සොයන්න...")}
          style={{
            padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
            fontSize: 12, background: "var(--paper)", color: "var(--ink)", width: 200,
          }}
        />
      </div>
      <ScrollTable
        headers={[
          { label: tr("Token", "சொல்", "ටෝකනය") },
          { label: tr("POS", "இலக்கணம் (POS)", "පද වර්ගය"), width: 110 },
          { label: tr("Base (Lemma)", "வேர்ச்சொல்", "මූල ස්වරූපය"), width: 140 },
          { label: tr("Action", "செயல்", "ක්‍රියාව"), width: 85 },
        ]}
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
        {tr("Edit POS", "POS திருத்து", "POS සංස්කරණය")}
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
  const [filterMode, setFilterMode] = useState("modified"); // 'modified' | 'all'

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

  const rows = tokens.slice(0, 200).map((tk) => {
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
        {tr("Edit Lemma", "வேர்ச்சொல் திருத்து", "මූල පදය සංස්කරණය")}
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
  const [filterMode, setFilterMode] = useState("has_morph"); // 'has_morph' | 'all'

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

  const rows = filtered.slice(0, 200).map((tk) => {
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
        {tr("Edit Features", "உருபியல் திருத்து", "ලක්ෂණ සංස්කරණය")}
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
    if (onNlpUpdated && res.nlp) {
      onNlpUpdated(res.nlp);
    }
    setFeedback({
      type: "success",
      text: tr(
        "NLP annotation updated successfully.",
        "NLP சிறுகுறிப்பு வெற்றிகரமாக புதுப்பிக்கப்பட்டது.",
        "NLP විවරණය සාර්ථකව යාවත්කාලීන කරන ලදී."
      ),
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
        <h2 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
          {pick(section?.label, lang)}
        </h2>
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
        {tab === "nlp" && doc.nlp && (
          <NlpTab
            docId={id}
            nlp={nlp}
            lang={lang}
            tr={tr}
            onNlpUpdated={(newNlp) => setDoc((prev) => ({ ...prev, nlp: newNlp }))}
          />
        )}
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
