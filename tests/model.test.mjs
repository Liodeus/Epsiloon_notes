import test from 'node:test';
import assert from 'node:assert/strict';
import { indexCards, findCards, relatedCards, sourceLink, normalize } from '../src/model.js';
const cards=indexCards([
  {id:'a',issueId:'epsiloon-51',theme:'Technologie',format:'enquête',title:'La faille des agents IA',summary:'Des instructions cachées dans un courrier.',oneLiner:'Sécurité des agents',keywords:['injection de prompt','agents IA'],takeaways:['Préserver les données'],issueDate:'2025-09-01',order:0},
  {id:'b',issueId:'epsiloon-56',theme:'Santé',format:'brève',title:'Les rythmes du sommeil',summary:'L’horloge biologique évolue.',oneLiner:'Retrouver son rythme',keywords:['sommeil','horloge'],takeaways:['Une étude préliminaire'],issueDate:'2026-02-01',order:1},
  {id:'c',issueId:'epsiloon-52',theme:'Technologie',format:'article',title:'Des robots en action',summary:'Ils utilisent des agents IA.',oneLiner:'Des machines',keywords:['agents IA','robotique'],takeaways:[],issueDate:'2025-10-01',order:2}
]);
const base={query:'',issue:'',theme:'',format:'',scope:'all',sort:'relevance'};
test('Recherche française sans accents et tous les termes requis',()=>{
  assert.equal(normalize('ÉTUDE d’IA'), 'etude d ia');
  assert.deepEqual(findCards(cards,{...base,query:'securite agents'}).map(c=>c.id),['a']);
  assert.deepEqual(findCards(cards,{...base,query:'preliminaire horloge'}).map(c=>c.id),['b']);
});
test('Filtres cumulés et favoris sont indépendants',()=>{
  const personal={a:{favorite:true},c:{review:true}};
  assert.deepEqual(findCards(cards,{...base,theme:'Technologie',issue:'epsiloon-51',scope:'favorites'},personal).map(c=>c.id),['a']);
  assert.deepEqual(findCards(cards,{...base,scope:'review'},personal).map(c=>c.id),['c']);
  assert.equal(findCards(cards,{...base,theme:'Santé',scope:'favorites'},personal).length,0);
});
test('Les sigles et mots courts ne correspondent pas au milieu des autres mots',()=>{
  const examples=indexCards([{id:'ia',title:'Une IA en action',summary:'De nouveaux agents',keywords:[]},{id:'space',title:'Une station spatiale',summary:'Beaucoup de recherches',keywords:[]}]);
  assert.deepEqual(findCards(examples,{...base,query:'IA'}).map(c=>c.id),['ia']);
  assert.equal(findCards(examples,{...base,query:'eau'}).length,0);
});
test('Tri chronologique et pertinence',()=>{
  assert.deepEqual(findCards(cards,{...base,sort:'newest'}).map(c=>c.id),['b','c','a']);
  assert.deepEqual(findCards(cards,{...base,sort:'oldest'}).map(c=>c.id),['a','c','b']);
  assert.equal(findCards(cards,{...base,query:'agents'}).at(0).id,'a');
});
test('Rapprochements fondés sur les mots clés',()=>{
  assert.deepEqual(relatedCards(cards[0],cards).map(c=>c.id),['c']);
});
test('Liens sources limités à la liseuse officielle sans jeton ni fragment douteux',()=>{
  const url='https://www.epsiloon.com/compte/reader.html?titleRef=ROCSC.EPS&nb=51#20';
  assert.equal(sourceLink({sourceUrl:url,readerPage:null}),url.split('#')[0]);
  assert.equal(sourceLink({sourceUrl:url,readerPage:24}),url.split('#')[0]+'#24');
  assert.equal(sourceLink({sourceUrl:url.split('#')[0]+'&token=secret',readerPage:null}),url.split('#')[0]);
  assert.throws(()=>sourceLink({sourceUrl:'javascript:alert(1)'}));
  assert.throws(()=>sourceLink({sourceUrl:'https://www.epsiloon.com.attacker.example/compte/reader.html'}));
});
