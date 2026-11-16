import { normalize } from '../src/model.js';

const mainFormats = new Set(['article', 'enquête', 'dossier']);
const isBackstage = source => normalize(source.title).includes('articles auxquels') || normalize(source.section) === 'droit de reponse';
const unique = values => [...new Set(values.filter(Boolean))];

// Keep the original working notes local. Only this short, article-level edition is exported.
export function compileIssue(issue, notes, sources, overrides = {}) {
  const groups = new Map(sources.map(source => [source.entity, { source, notes: [] }]));
  for (const note of notes) {
    const group = groups.get(note.sourceEntity);
    if (!group) throw new Error(`Source inconnue : ${note.id}`);
    group.notes.push(note);
  }
  const cards = [], covered = new Set();
  for (const {source, notes: batch} of groups.values()) {
    if (isBackstage(source)) continue;
    const lead = batch.find(note => mainFormats.has(note.format));
    if (!lead) continue;
    // Some reader entries append unrelated short news after the main article.
    const sameArticle = normalize(source.section).startsWith('c est dans l air') || source.entity === 'entity://678556'
      ? batch.filter(note => mainFormats.has(note.format)) : batch;
    for (const note of sameArticle) covered.add(note.id);
    const edit = overrides[source.entity] || {};
    const takeaways = sameArticle.length > 1
      ? [lead.takeaways[0], ...sameArticle.filter(note => note !== lead).map(note => note.oneLiner)].slice(0, 3)
      : lead.takeaways.slice(0, 2);
    cards.push({
      ...lead,
      ...edit,
      sourceTitle: source.title,
      summary: edit.summary || lead.summary,
      takeaways: edit.takeaways || takeaways,
      keywords: edit.keywords || unique(lead.keywords).slice(0, 5),
      legacyIds: sameArticle.map(note => note.id),
      searchTerms: unique([source.title, ...sameArticle.flatMap(note => [note.title, ...note.keywords])]).join(' ')
    });
  }
  const rest = notes.filter(note => !covered.has(note.id) && !isBackstage(groups.get(note.sourceEntity).source));
  const news = rest.filter(note => note.format !== 'image');
  // A small digest, with several themes represented, instead of dozens of extra cards.
  const selected = [], themes = new Set();
  for (const note of news) if (!themes.has(note.theme) && selected.length < 6) { selected.push(note); themes.add(note.theme); }
  for (const note of news) if (selected.length < 6 && !selected.includes(note)) selected.push(note);
  selected.push(...rest.filter(note => note.format === 'image').slice(0, 2));
  return {
    cards,
    roundup: {
      issueId: issue.id,
      legacyIds: notes.filter(note => !covered.has(note.id)).map(note => note.id),
      items: selected.map(note => ({title: note.title, text: note.oneLiner, kind: note.format === 'image' ? 'image' : 'brève'}))
    }
  };
}
