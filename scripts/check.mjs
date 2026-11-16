import { readFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
for(const file of ['src/model.js','src/app.js','scripts/build.mjs','scripts/compile-articles.mjs','scripts/serve.mjs'])execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
const html=await readFile('src/index.html','utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
if(new Set(ids).size!==ids.length)throw new Error('Identifiants DOM dupliqués.');
const template=await readFile('src/password-template.html','utf8');
if(!template.includes('/*[|js_staticrypt|]*/0')||!template.includes('/*[|staticrypt_config|]*/0'))throw new Error('Gabarit StatiCrypt incomplet.');
const output=await readFile('dist/index.html','utf8');
if(!output.includes('staticryptEncryptedMsgUniqueVariableName'))throw new Error('Le carnet de publication doit être chiffré.');
const files=(await readdir('dist')).sort();
if(JSON.stringify(files)!==JSON.stringify(['.nojekyll','index.html','robots.txt']))throw new Error('Fichiers inattendus dans dist.');
for(const file of files)if(!(await stat('dist/'+file)).isFile())throw new Error('Sous-dossier interdit dans dist.');
const tracked=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).split('\n').filter(Boolean);
if(tracked.some(p=>p.startsWith('private/')||p.endsWith('.pdf')||p.startsWith('.env')&&p!=='.env.example'))throw new Error('Une source privée est suivie par Git.');
for(const name of await readdir('private/data')) {
  if(!name.endsWith('.json'))continue;
  const cards=JSON.parse(await readFile('private/data/'+name,'utf8'));
  for(const card of cards)if(output.includes(card.summary)||output.includes(card.oneLiner))throw new Error('Une fiche est lisible avant déchiffrement.');
}
const preview=await readFile('private/preview/index.html','utf8');
const edition=JSON.parse(preview.match(/<script id="carnet-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const articles=new Set();
for(const card of edition.cards){
  const key=card.issueId+'/'+card.sourceEntity;
  if(articles.has(key))throw new Error('Plusieurs fiches pour un seul article.');
  articles.add(key);
  if(!['article','enquête','dossier'].includes(card.format)||card.takeaways.length>3||card.keywords.length>5)throw new Error('Fiche trop détaillée ou mauvais format.');
  if(output.includes(card.summary))throw new Error('Une synthèse est lisible avant déchiffrement.');
}
if(edition.roundups.length!==edition.issues.length||edition.roundups.some(item=>item.items.length>8))throw new Error('Récapitulatifs invalides.');
console.log('Vérifications réussies : syntaxe, gabarit, chiffrement, contenu publié et exclusion des sources privées.');
