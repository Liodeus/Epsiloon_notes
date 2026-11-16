import test from 'node:test';
import assert from 'node:assert/strict';
import { compileIssue } from '../scripts/compile-articles.mjs';

const source = (entity, title, section = 'L_ENQUÊTE') => ({entity, title, section});
const note = (id, sourceEntity, format = 'article', theme = 'Technologie') => ({
  id, sourceEntity, issueId: 'epsiloon-51', format, theme,
  title: id, summary: 'Un résumé du sujet.', oneLiner: `L’idée de ${id}.`,
  takeaways: ['Un résultat.', 'Une limite.'], keywords: ['science', 'concept', 'étude']
});

test('Un article découpé devient une seule fiche et garde les anciens liens', () => {
  const notes = [note('principal', 'a', 'enquête'), note('encadré', 'a'), note('autre-article', 'b')];
  const {cards} = compileIssue({id:'epsiloon-51'}, notes, [source('a','Un article'), source('b','Un autre')], {
    a: {summary:'La synthèse de tout l’article.', takeaways:['Résultat principal.', 'Point de l’encadré.']}
  });
  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0].legacyIds, ['principal', 'encadré']);
  assert.equal(cards[0].summary, 'La synthèse de tout l’article.');
  assert.match(cards[0].searchTerms, /encadré/);
  assert.equal(cards[0].takeaways.length, 2);
});

test('Les actualités ajoutées après un article restent dans le récapitulatif', () => {
  const notes = [note('maven', 'a'), note('actualite-sans-rapport', 'a', 'brève')];
  const result = compileIssue({id:'epsiloon-51'}, notes, [source('a','Maven','C_EST_DANS_L_AIR')]);
  assert.deepEqual(result.cards[0].legacyIds, ['maven']);
  assert.deepEqual(result.roundup.items.map(item => item.title), ['actualite-sans-rapport']);
  assert.deepEqual(result.roundup.legacyIds, ['actualite-sans-rapport']);
});

test('Les brèves et images donnent un récapitulatif court sans cartes supplémentaires', () => {
  const notes = Array.from({length:18}, (_,i) => note(`brève-${i}`, 'a', 'brève', i % 2 ? 'Vivant' : 'Espace'));
  notes.push(...Array.from({length:6}, (_,i) => note(`image-${i}`, 'b', 'image')));
  const {cards, roundup} = compileIssue({id:'epsiloon-51'}, notes, [source('a','Fil d’actus'), source('b','Images')]);
  assert.equal(cards.length, 0);
  assert.equal(roundup.items.length, 8);
  assert.equal(roundup.items.filter(item => item.kind === 'image').length, 2);
  assert.equal(roundup.legacyIds.length, 24);
  assert.equal(new Set(roundup.items.map(item => item.title)).size, 8);
});

test('Les coulisses et droits de réponse ne deviennent pas de nouveaux articles', () => {
  const result = compileIssue({id:'epsiloon-51'}, [note('coulisses','a'),note('réponse','b')], [
    source('a','Les articles auxquels vous avez échappé'), source('b','Droit de réponse','DROIT_DE_RÉPONSE')
  ]);
  assert.equal(result.cards.length, 0);
  assert.equal(result.roundup.items.length, 0);
});
