import { useMemo, useState } from "react";

const PAGE_SIZE = 100;

function getTextParts(sourceText, nlp) {
  if (typeof sourceText === "string" && sourceText.trim()) {
    return [sourceText];
  }

  if (Array.isArray(nlp?.sentences)) {
    return nlp.sentences.filter((sentence) => typeof sentence === "string");
  }

  return typeof sourceText === "string" ? [sourceText] : null;
}

function* readWords(parts) {
  // Letters start a word. Vowel signs, pulli marks, and joiners
  // stay attached. Spaces, punctuation, and numbers separate words.
  const pattern = /\p{L}[\p{L}\p{M}\u200C\u200D]*/gu;

  for (const text of parts) {
    for (const match of text.matchAll(pattern)) {
      yield match[0].normalize("NFC");
    }
  }
}

function wordKey(word) {
  return word.toLowerCase().normalize("NFC");
}

function analyzeWords(sourceText, nlp) {
  const parts = getTextParts(sourceText, nlp);
  if (parts === null) return null;

  const counts = new Map();
  let total = 0;

  for (const word of readWords(parts)) {
    const key = wordKey(word);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total += 1;
  }

  return { parts, counts, total };
}

// Keeps the existing two-column Word / Count CSV export working.
export function getWordCountRows(sourceText, nlp) {
  const result = analyzeWords(sourceText, nlp);
  if (result === null) return null;

  return Array.from(result.counts.entries()).sort(
    (first, second) => second[1] - first[1]
  );
}

function getTokenPage(result, search, page) {
  if (!result) return { rows: [], matches: 0 };

  const query = wordKey(search.trim());
  const start = page * PAGE_SIZE;
  const rows = [];
  let matches = 0;

  // Each entry is one unique word and its full document count.
  for (const [word, count] of result.counts) {
    if (query && !word.includes(query)) continue;

    if (matches >= start && rows.length < PAGE_SIZE) {
      rows.push({
        number: matches + 1,
        word,
        count,
      });
    }

    matches += 1;
  }

  return { rows, matches };
}

const cell = {
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
  textAlign: "left",
};

export default function TokensSection({ sourceText, nlp, tr, desc }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const result = useMemo(
    () => analyzeWords(sourceText, nlp),
    [sourceText, nlp]
  );

  const { rows, matches } = useMemo(
    () => getTokenPage(result, search, page),
    [result, search, page]
  );

  if (!result) {
    return (
      <p>
        {tr(
          "Document text is unavailable. Check the Cleaned Text tab.",
          "ஆவண உரை கிடைக்கவில்லை. சுத்தப்படுத்தப்பட்ட உரையைப் பார்க்கவும்.",
          "ලේඛනයේ පෙළ ලබා ගත නොහැක. පිරිසිදු කළ පෙළ බලන්න."
        )}
      </p>
    );
  }

  const pages = Math.max(1, Math.ceil(matches / PAGE_SIZE));

  return (
    <section>
      {typeof desc === "string" && desc && <p>{desc}</p>}

      <p>
        {tr("Total words", "மொத்தச் சொற்கள்", "මුළු වචන ගණන")}{" "}
        <strong>{result.total.toLocaleString()}</strong>
        {" · "}
        {tr("Unique words", "தனித்துவமான சொற்கள்", "අනන්‍ය වචන")}{" "}
        <strong>{result.counts.size.toLocaleString()}</strong>
      </p>

      <input
        type="search"
        value={search}
        aria-label={tr("Search words", "சொற்களைத் தேடுங்கள்", "වචන සොයන්න")}
        placeholder={tr("Search words", "சொற்களைத் தேடுங்கள்", "වචන සොයන්න")}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(0);
        }}
      />

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
        <thead>
          <tr>
            <th scope="col" style={cell}>
              {tr("Token No.", "சொல் எண்", "වචන අංකය")}
            </th>
            <th scope="col" style={cell}>
              {tr("Word", "சொல்", "වචනය")}
            </th>
            <th scope="col" style={{ ...cell, textAlign: "right" }}>
              {tr("Count in document", "ஆவணத்தில் வரும் எண்ணிக்கை", "ලේඛනයේ වාර ගණන")}
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(({ number, word, count }) => (
            <tr key={number}>
              <td style={cell}>{number.toLocaleString()}</td>
              <td style={cell}>{word}</td>
              <td style={{ ...cell, textAlign: "right" }}>
                {count.toLocaleString()}
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={3} style={cell}>
                {tr("No words found.", "சொற்கள் கிடைக்கவில்லை.", "වචන හමු නොවීය.")}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {pages > 1 && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            {tr("Previous", "முந்தைய", "පෙර")}
          </button>

          <span>{page + 1} / {pages}</span>

          <button
            type="button"
            disabled={page + 1 >= pages}
            onClick={() => setPage(page + 1)}
          >
            {tr("Next", "அடுத்த", "ඊළඟ")}
          </button>
        </div>
      )}
    </section>
  );
}