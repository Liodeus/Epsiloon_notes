export const THEMES = ['Espace', 'Physique', 'Vivant', 'Santé', 'Environnement', 'Technologie', 'Société'];
export const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr').replace(/[’']/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function indexCards(cards) {
  return cards.map(card => ({ ...card, search: normalize([card.title, card.sourceTitle, card.searchTerms, card.oneLiner, card.summary, card.theme, card.author, ...(card.takeaways || []), ...(card.keywords || [])].join(' ')), titleSearch: normalize(card.title) }));
}
export function findCards(cards, state, personal = {}) {
  const terms = normalize(state.query).split(' ').filter(Boolean);
  const rules=terms.map(term=>term.length<=3?new RegExp('(?:^| )'+term+'(?: |$)'):null);
  const contains=(text,term,index)=>rules[index]?rules[index].test(text):text.includes(term);
  const found = cards.filter(card => (!state.issue || card.issueId === state.issue) && (!state.theme || card.theme === state.theme) && (!state.format || card.format === state.format) && (state.scope !== 'favorites' || personal[card.id]?.favorite) && (state.scope !== 'review' || personal[card.id]?.review) && terms.every((term,index) => contains(card.search,term,index)));
  return found.sort((a, b) => {
    if (terms.length && state.sort === 'relevance') {
      const score = card => terms.reduce((n, term,index) => n + (contains(card.titleSearch,term,index) ? 5 : 1) + ((card.keywords || []).some(k => contains(normalize(k),term,index)) ? 2 : 0), 0);
      const delta = score(b) - score(a); if (delta) return delta;
    }
    if (state.sort === 'title') return a.title.localeCompare(b.title, 'fr');
    const delta = (b.issueDate || '').localeCompare(a.issueDate || '');
    return (state.sort === 'oldest' ? -delta : delta) || (a.order - b.order);
  });
}
export function relatedCards(card, cards, limit = 3) {
  const words = new Set((card.keywords || []).map(normalize));
  return cards.filter(c => c.id !== card.id).map(c => ({ card: c, score: (c.keywords || []).filter(k => words.has(normalize(k))).length * 3 + (c.theme === card.theme ? 1 : 0) })).filter(x => x.score >= 3).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.card);
}
export function sourceLink(card) {
  const url = new URL(card.sourceUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'www.epsiloon.com' || url.pathname !== '/compte/reader.html' || url.username || url.password) throw new Error('Référence Epsiloon invalide');
  const titleRef=url.searchParams.get('titleRef'),number=url.searchParams.get('nb');
  if(!['ROCSC.EPS','ROCSC.EPSHS'].includes(titleRef)||!/^\d+$/.test(number)||Number(number)<1)throw new Error('Numéro Epsiloon invalide');
  const safe=new URL('https://www.epsiloon.com/compte/reader.html');safe.searchParams.set('titleRef',titleRef);safe.searchParams.set('nb',number);
  safe.hash = Number.isInteger(card.readerPage) && card.readerPage > 0 ? String(card.readerPage) : '';
  return safe.href;
}
