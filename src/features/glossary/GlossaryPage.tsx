import { useEffect, useMemo, useState } from 'react';
import { useAppChrome } from '@/context/AppChromeContext';
import {
  TRACKING_GLOSSARY,
  MATCH_GLOSSARY,
  GLOBAL_GLOSSARY,
  type GlossaryEntry,
} from '@/components/SectionHelp';

type Section = { title: string; entries: GlossaryEntry[] };

function dedup(entries: GlossaryEntry[]): GlossaryEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.abbr}::${e.full}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const matchEntries = Object.values(MATCH_GLOSSARY).flat();
const globalEntries = Object.values(GLOBAL_GLOSSARY).flat();

const SECTIONS: Section[] = [
  { title: 'Tracking', entries: TRACKING_GLOSSARY },
  { title: 'Match stats', entries: dedup(matchEntries) },
  { title: 'Global stats', entries: dedup(globalEntries.filter((g) => !matchEntries.some((m) => m.abbr === g.abbr && m.full === g.full))) },
];

function matchesQuery(entry: GlossaryEntry, q: string): boolean {
  return (
    entry.abbr.toLowerCase().includes(q) ||
    entry.full.toLowerCase().includes(q) ||
    entry.desc.toLowerCase().includes(q)
  );
}

export function GlossaryPage() {
  const { setTeamHeader } = useAppChrome();
  const [query, setQuery] = useState('');

  useEffect(() => {
    setTeamHeader({ backTo: '/', title: 'Glossary' });
    return () => setTeamHeader(null);
  }, [setTeamHeader]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      entries: s.entries.filter((e) => matchesQuery(e, q)),
    })).filter((s) => s.entries.length > 0);
  }, [q]);

  return (
    <div className="glossary-page">
      <h1 className="sr-only">Glossary</h1>
      <div className="glossary-search-wrap">
        <input
          type="search"
          className="glossary-search"
          placeholder="Filter by term, name, or keyword…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filter glossary"
          autoComplete="off"
        />
        {query && (
          <button type="button" className="glossary-search-clear" aria-label="Clear filter" onClick={() => setQuery('')}>
            ×
          </button>
        )}
      </div>
      {filtered.length === 0 ? (
        <p className="muted glossary-empty">No terms match &ldquo;{query}&rdquo;</p>
      ) : (
        filtered.map((section) => (
          <section key={section.title} className="card glossary-section">
            <h2 className="glossary-section-title">{section.title}</h2>
            <dl className="glossary-list">
              {section.entries.map((e, i) => {
                const showGroup = e.group && (i === 0 || section.entries[i - 1].group !== e.group);
                return (
                  <div key={`${e.abbr}-${i}`}>
                    {showGroup && <h3 className="glossary-group-heading">{e.group}</h3>}
                    <div className="glossary-entry">
                      <dt className="glossary-term">{e.abbr}</dt>
                      <dd className="glossary-def">
                        <strong>{e.full}</strong> — {e.desc}
                      </dd>
                    </div>
                  </div>
                );
              })}
            </dl>
          </section>
        ))
      )}
    </div>
  );
}
