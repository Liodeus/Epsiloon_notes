(() => {
  'use strict';
  /* MODEL_CODE */
  const data = JSON.parse(document.getElementById('carnet-data').textContent);
  const issueMap = new Map(data.issues.map(issue => [issue.id, issue]));
  const cards = indexCards(data.cards.map((card, order) => ({ ...card, order, issueDate: issueMap.get(card.issueId)?.date || '' })));
  const cardMap = new Map(cards.flatMap(card => (card.legacyIds || [card.id]).map(id => [id, card])));
  const $ = selector => document.querySelector(selector);
  const escape = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = { query: '', issue: '', theme: '', format: '', scope: 'all', sort: 'relevance', visible: 30, view: 'issues' };
  let personal = {};
  try { const saved = JSON.parse(localStorage.getItem('epsiloon-personal-v1') || '{}'); if (saved && typeof saved === 'object' && !Array.isArray(saved)) personal = saved; } catch {}
  try {
    if (localStorage.getItem('epsiloon-article-edition') !== '2') {
      for (const card of cards) {
        const saved = (card.legacyIds || [card.id]).map(id => personal[id] || {});
        personal[card.id] = {favorite: saved.some(item => item.favorite), review: saved.some(item => item.review)};
      }
      localStorage.setItem('epsiloon-personal-v1', JSON.stringify(personal));
      localStorage.setItem('epsiloon-article-edition', '2');
    }
  } catch {}
  const dialog = $('#card-dialog'); let currentCard; let lastFocus; let toastTimer;
  function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 2200); }
  function togglePersonal(id, field) {
    personal[id] = { ...personal[id], [field]: !personal[id]?.[field] };
    try { localStorage.setItem('epsiloon-personal-v1', JSON.stringify(personal)); } catch { toast('Ce navigateur ne permet pas d’enregistrer tes favoris.'); }
    render(); if (dialog.open && currentCard?.id === id) renderDetail(currentCard);
  }
  function showView(view) {
    state.view = view; $('.app-shell').classList.toggle('is-collection', view === 'issues'); $('#cards-view').hidden = view !== 'cards'; $('#issues-view').hidden = view !== 'issues';
    for (const [id, name] of [['#view-cards','cards'],['#view-issues','issues']]) { $(id).classList.toggle('active', view === name); $(id).setAttribute('aria-pressed', String(view === name)); }
  }
  for (const issue of data.issues) { const option = document.createElement('option'); option.value = issue.id; option.textContent = `${issue.label} · ${issue.dateLabel}`; $('#issue-filter').append(option); }
  for (const theme of THEMES) { const option = document.createElement('option'); option.value = theme; option.textContent = theme; $('#theme-filter').append(option); }
  $('#collection-label').textContent = `${data.issues.length} numéros · ${cards.length} articles`;
  function render() {
    const found = findCards(cards, state, personal);
    $('#count-all').textContent = String(cards.length);
    $('#count-favorites').textContent = String(cards.filter(c => personal[c.id]?.favorite).length);
    $('#count-review').textContent = String(cards.filter(c => personal[c.id]?.review).length);
    $('#results-count').textContent = `${found.length} article${found.length > 1 ? 's' : ''}${state.query ? ' pour « ' + state.query + ' »' : ' à retrouver'}`;
    $('#empty').hidden = found.length !== 0;
    $('#more').hidden = found.length <= state.visible;
    $('#page-title').textContent = state.scope === 'favorites' ? 'Mes idées préférées.' : state.scope === 'review' ? 'On y revient.' : state.issue ? issueMap.get(state.issue).label + ' · Mes lectures.' : 'L’essentiel des articles.';
    document.querySelectorAll('[data-scope]').forEach(b => { b.classList.toggle('active', b.dataset.scope === state.scope); b.setAttribute('aria-pressed', String(b.dataset.scope === state.scope)); });
    $('#issue-filter').value = state.issue; $('#theme-filter').value = state.theme; $('#search').value = state.query;
    $('#active-filters').innerHTML = [['issue',state.issue ? issueMap.get(state.issue).label : ''],['theme',state.theme],['format',state.format]].filter(([,value]) => value).map(([field,value]) => `<button class="filter-chip" type="button" data-remove="${field}" aria-label="Retirer le filtre ${escape(value)}">${escape(value)}<span aria-hidden="true">×</span></button>`).join('');
    $('#results').innerHTML = found.slice(0, state.visible).map(card => {
      const issue = issueMap.get(card.issueId), fav = !!personal[card.id]?.favorite, review = !!personal[card.id]?.review;
      return `<article class="reading-card"><button type="button" class="card-open" data-open="${escape(card.id)}" aria-label="Lire la fiche : ${escape(card.title)}"><div class="card-top"><span class="theme-label">${escape(card.theme)}</span><span class="issue-badge">${escape(issue.label)}</span></div><h2>${escape(card.title)}</h2><p class="card-summary">${escape(card.oneLiner || card.summary)}</p></button><div class="card-bottom"><span>${escape(card.format)} · 30 s</span><div class="card-actions"><button class="card-action" type="button" data-personal="favorite" data-id="${escape(card.id)}" aria-label="${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${escape(card.title)}" aria-pressed="${fav}">${fav ? '★' : '☆'}</button><button class="card-action" type="button" data-personal="review" data-id="${escape(card.id)}" aria-label="${review ? 'Retirer de la liste à revoir' : 'Marquer à revoir'} : ${escape(card.title)}" aria-pressed="${review}">↻</button></div></div></article>`;
    }).join('');
    renderRoundup();
  }
  function renderRoundup() {
    const roundup = data.roundups?.find(item => item.issueId === state.issue);
    const visible = roundup?.items.length && state.scope === 'all' && !state.query && !state.theme;
    $('#issue-roundup').hidden = !visible;
    $('#issue-roundup').open = false;
    $('#roundup-count').textContent = visible ? `${roundup.items.length} repères` : '';
    $('#roundup-content').innerHTML = visible ? `<p class="roundup-intro">Une petite sélection pour se remettre le reste du numéro en tête.</p><ul>${roundup.items.map(item => `<li><span class="roundup-kind">${item.kind === 'image' ? 'En image' : 'Brève'}</span><strong>${escape(item.title)}</strong><p>${escape(item.text)}</p></li>`).join('')}</ul>` : '';
  }
  function reset() { Object.assign(state, {query:'',issue:'',theme:'',format:'',scope:'all',visible:30}); showView('cards'); render(); }
  function renderDetail(card) {
    const issue = issueMap.get(card.issueId); currentCard = card;
    $('#detail-issue').textContent = `${issue.label} · ${issue.dateLabel}`;
    $('#detail-content').innerHTML = `<div class="detail-head"><span class="theme-label">${escape(card.theme)}</span><span class="detail-meta">L’essentiel · 30 secondes</span></div><h2 id="detail-title">${escape(card.title)}</h2><section class="detail-section"><p>${escape(card.summary)}</p></section><section class="detail-section"><h3>À retenir</h3><ul class="takeaways">${card.takeaways.slice(0,3).map(t => `<li><span>${escape(t)}</span></li>`).join('')}</ul></section><div class="detail-tags">${card.keywords.slice(0,5).map(k => `<button type="button" class="keyword-button" data-keyword="${escape(k)}">#${escape(k)}</button>`).join('')}</div><a class="source-link" href="${escape(sourceLink(card))}" target="_blank" rel="noopener noreferrer">Relire l’article sur Epsiloon ↗</a><p class="source-note">${card.readerPage ? `Repère dans la liseuse : ${escape(card.readerPage)}. ` : 'À retrouver par son titre dans le sommaire. '}Abonnement nécessaire.</p><div class="detail-footer"><button type="button" data-personal="favorite" data-id="${escape(card.id)}" aria-pressed="${!!personal[card.id]?.favorite}">${personal[card.id]?.favorite ? '★ Dans mes favoris' : '☆ Favori'}</button><button type="button" data-personal="review" data-id="${escape(card.id)}" aria-pressed="${!!personal[card.id]?.review}">${personal[card.id]?.review ? '↻ À revoir' : '↻ À revoir plus tard'}</button><button id="copy-link" type="button">Copier le lien</button></div>`;
  }
  function openCard(id) { const card = cardMap.get(id); if (!card) return; if (!dialog.open) lastFocus = document.activeElement; renderDetail(card); history.replaceState(null, '', '#fiche=' + encodeURIComponent(id)); if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0; $('#close-dialog').focus(); }
  function closeCard() { dialog.close(); history.replaceState(null, '', location.pathname + location.search); const target=lastFocus?.isConnected?lastFocus:document.querySelector(`[data-open="${CSS.escape(currentCard?.id||'')}"]`)||$('#search'); target?.focus?.(); }
  document.addEventListener('click', async event => {
    const open = event.target.closest('[data-open]'); if (open) { openCard(open.dataset.open); return; }
    const action = event.target.closest('[data-personal]'); if (action) { togglePersonal(action.dataset.id, action.dataset.personal); return; }
    const keyword = event.target.closest('[data-keyword]'); if (keyword) { closeCard(); Object.assign(state, {query:keyword.dataset.keyword,issue:'',theme:'',format:'',scope:'all',visible:30}); showView('cards'); render(); $('#search').focus(); return; }
    const remove = event.target.closest('[data-remove]'); if (remove) { state[remove.dataset.remove] = ''; state.visible = 30; render(); }
    const scope = event.target.closest('[data-scope]'); if (scope) { state.scope = scope.dataset.scope; state.visible = 30; showView('cards'); render(); }
    if (event.target.closest('#copy-link')) { try { await navigator.clipboard.writeText(location.href); toast('Lien de la fiche copié.'); } catch { toast('Copie le lien depuis la barre d’adresse.'); } }
  });
  $('#search').addEventListener('input', event => { state.query = event.target.value; state.visible = 30; render(); });
  $('.search-form').addEventListener('submit', event => event.preventDefault());
  for (const [id, field] of [['#issue-filter','issue'],['#theme-filter','theme'],['#sort','sort']]) $(id).addEventListener('change', event => { state[field] = event.target.value; state.visible = 30; showView('cards'); render(); });
  $('#reset').addEventListener('click', reset); $('#empty-reset').addEventListener('click', reset);
  $('#more').addEventListener('click', () => { const previous = state.visible; state.visible += 30; render(); $('#results').children[previous]?.querySelector('button')?.focus(); });
  $('#view-cards').addEventListener('click', () => showView('cards')); $('#view-issues').addEventListener('click', () => showView('issues'));
  $('.brand').addEventListener('click', event => { event.preventDefault(); reset(); showView('issues'); });
  $('#close-dialog').addEventListener('click', closeCard); dialog.addEventListener('cancel', event => { event.preventDefault(); closeCard(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeCard(); } });
  document.addEventListener('keydown', event => { if (event.key === '/' && !dialog.open && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { event.preventDefault(); showView('cards'); $('#search').focus(); } });
  $('#issues-grid').innerHTML = data.issues.map(issue => `<button class="issue-tile" type="button" data-issue="${escape(issue.id)}"><span class="issue-cover ${issue.type === 'hs' ? 'hs' : ''}"><small>${issue.type === 'hs' ? 'Hors-série' : 'Mensuel'} · Epsiloon</small><strong>${escape(issue.label)}</strong></span><span class="issue-info"><span>${escape(issue.dateLabel)}</span><small>${cards.filter(c => c.issueId === issue.id).length} articles · en bref ↗</small></span></button>`).join('');
  $('#issues-grid').addEventListener('click', event => { const button = event.target.closest('[data-issue]'); if (button) { Object.assign(state, {query:'',issue:button.dataset.issue,theme:'',format:'',scope:'all',visible:30}); showView('cards'); render(); $('#page-title').scrollIntoView({block:'start'}); } });
  let theme = 'light'; try { theme = localStorage.getItem('epsiloon-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch {}
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; try { localStorage.setItem('epsiloon-theme', theme); } catch {} });
  $('#lock').addEventListener('click', () => { try { localStorage.removeItem('epsiloon-unlock-key'); localStorage.removeItem('epsiloon-unlock-expiry'); } catch {} if (dialog.open) dialog.close(); document.body.replaceChildren(); history.replaceState(null, '', location.pathname + location.search); location.reload(); });
  window.addEventListener('storage', event => { if (event.key === 'epsiloon-personal-v1') { try { personal = JSON.parse(event.newValue || '{}'); render(); if (dialog.open) renderDetail(currentCard); } catch {} } });
  render(); showView('issues');
  const target = new URLSearchParams(location.hash.slice(1)).get('fiche'); if (target) {
    if (cardMap.has(target)) { showView('cards'); openCard(target); }
    else {
      const roundup = data.roundups?.find(item => item.legacyIds.includes(target));
      if (roundup) { state.issue = roundup.issueId; showView('cards'); render(); $('#issue-roundup').open = true; $('#issue-roundup').scrollIntoView({block:'start'}); }
    }
  }
})();
