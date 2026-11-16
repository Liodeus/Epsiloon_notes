import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceLink, THEMES } from '../src/model.js';
import { compileIssue } from './compile-articles.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const previewOnly = process.argv.includes('--preview-only');
const partial = process.argv.includes('--allow-partial');
const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const catalog = JSON.parse(await readFile('private/sources/catalog.json', 'utf8'));
const issues = catalog.map(item => {
  const url = new URL(item.href), number = Number(url.searchParams.get('nb')), type = url.searchParams.get('titleRef') === 'ROCSC.EPSHS' ? 'hs' : 'mensuel';
  const dateLabel = item.label.replace(/^.*?\d+\s+/, ''), [month, year] = dateLabel.split(' ');
  const date = `${year}-${String(months.indexOf(month) + 1).padStart(2, '0')}-01`;
  return {id:`epsiloon-${type === 'hs' ? 'hs-' : ''}${number}`,number,type,label:`${type === 'hs' ? 'HS ' : ''}n°${number}`,date,dateLabel,sourceUrl:item.href};
}).sort((a,b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
const initialIds=[...Array.from({length:15},(_,i)=>`epsiloon-${51+i}`),...Array.from({length:5},(_,i)=>`epsiloon-hs-${16+i}`)];
if(initialIds.some(id=>!issues.some(issue=>issue.id===id)))throw new Error('Le catalogue doit contenir les 20 numéros demandés au minimum.');
const cards = [], roundups = [], notes = [], missing = [], seen = new Set();
let overrides = {};
try { overrides = JSON.parse(await readFile('private/editorial/article-overrides.json', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const issue of issues) {
  let batch;
  try { batch = JSON.parse(await readFile(`private/data/${issue.id}.json`, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; missing.push(issue.id); continue; }
  if (!Array.isArray(batch) || !batch.length) throw new Error(`Aucune fiche pour ${issue.id}`);
  for (const card of batch) {
    if (seen.has(card.id)) throw new Error(`Identifiant en double : ${card.id}`); seen.add(card.id);
    if (card.issueId !== issue.id || !THEMES.includes(card.theme)) throw new Error(`Métadonnées invalides : ${card.id}`);
    for (const key of ['title','oneLiner','summary','nuance']) if (typeof card[key] !== 'string' || !card[key].trim()) throw new Error(`Champ ${key} manquant : ${card.id}`);
    if (!Array.isArray(card.takeaways) || card.takeaways.length < 2 || !Array.isArray(card.keywords) || card.keywords.length < 3) throw new Error(`Fiche incomplète : ${card.id}`);
    if (!['enquête','dossier','article','brève','image'].includes(card.format)) throw new Error(`Format invalide : ${card.id}`);
    sourceLink(card);
    notes.push(card);
  }
  if(!partial){
    const directory=`private/sources/${issue.id}`;
    const status=JSON.parse(await readFile(`${directory}/complete.json`,'utf8'));
    const sources=JSON.parse(await readFile(`${directory}/articles.json`,'utf8'));
    const coverage=JSON.parse(await readFile(`private/coverage/${issue.id}.json`,'utf8'));
    if(!status.complete||sources.length!==status.expected)throw new Error(`Collecte incomplète : ${issue.id}`);
    const represented=new Set(batch.map(card=>card.sourceEntity)),excluded=new Set(coverage.excluded.map(item=>item.sourceEntity));
    if(coverage.issueId!==issue.id||coverage.excluded.some(item=>!item.reason||!item.title))throw new Error(`Bilan invalide : ${issue.id}`);
    for(const item of sources)if(!represented.has(item.entity)&&!excluded.has(item.entity))throw new Error(`Sujet non couvert : ${issue.id}, ${item.title}`);
    for(const entity of represented)if(!sources.some(item=>item.entity===entity))throw new Error(`Source inconnue : ${issue.id}, ${entity}`);
    for(const entity of excluded)if(represented.has(entity)||!sources.some(item=>item.entity===entity))throw new Error(`Exclusion incohérente : ${issue.id}, ${entity}`);
  }
  const sources = JSON.parse(await readFile(`private/sources/${issue.id}/articles.json`, 'utf8'));
  const edition = compileIssue(issue, batch, sources, overrides);
  cards.push(...edition.cards);
  roundups.push(edition.roundup);
}
if (missing.length && !partial) throw new Error(`Fiches manquantes : ${missing.join(', ')}. La publication complète est bloquée.`);
if (!cards.length) throw new Error('Il faut au moins une fiche pour préparer le carnet.');
const model = (await readFile('src/model.js', 'utf8')).replace(/^export /gm, '');
const app = (await readFile('src/app.js', 'utf8')).replace('/* MODEL_CODE */', () => model);
const json = JSON.stringify({version:2,issues:partial ? issues.filter(i => !missing.includes(i.id)) : issues,cards,roundups}).replace(/</g, '\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const styles=await readFile('src/styles.css','utf8');
const html = (await readFile('src/index.html', 'utf8')).replace('/* APP_STYLES */', () => styles).replace('/* APP_DATA */', () => json).replace('/* APP_SCRIPT */', () => app);
await mkdir('private/preview',{recursive:true});
await writeFile('private/preview/index.html',html,{mode:0o600});
console.log(`Carnet préparé : ${cards.length} articles, ${roundups.length} récapitulatifs, ${issues.length-missing.length} numéros${partial ? ' (aperçu partiel)' : ''}.`);
if (previewOnly) process.exit(0);
if (partial) throw new Error('Un aperçu partiel ne peut pas être chiffré pour publication.');

async function readPassword() {
  if (process.env.STATICRYPT_PASSWORD) return process.env.STATICRYPT_PASSWORD;
  if (process.argv.includes('--password-stdin')) {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdout.write('Phrase de passe attendue sur l’entrée masquée.\n');
    let value='';
    for await (const chunk of process.stdin) {
      const text=chunk.toString();
      if(text.includes('\u0003')) { if(process.stdin.isTTY)process.stdin.setRawMode(false);process.exit(130); }
      value+=text;
      if(value.includes('\n')||value.includes('\r'))break;
    }
    if(process.stdin.isTTY)process.stdin.setRawMode(false);
    process.stdin.pause();return value.trim();
  }
  if (!process.stdin.isTTY) throw new Error('Définir STATICRYPT_PASSWORD ou utiliser un terminal interactif.');
  const prompt=async label=>{
    process.stdout.write(label);process.stdin.setRawMode(true);process.stdin.resume();let value='';
    return new Promise((resolve,reject)=>{const handle=chunk=>{for(const char of chunk.toString()){if(char==='\u0003'){process.stdin.off('data',handle);process.stdin.setRawMode(false);process.stdin.pause();reject(new Error('Annulé'));return;}if(char==='\r'||char==='\n'){process.stdin.off('data',handle);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value);return;}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else value+=char;}};process.stdin.on('data',handle);});
  };
  const first=await prompt('Phrase de passe (au moins 12 caractères, saisie masquée) : '),second=await prompt('Confirme ta phrase de passe : ');
  if(first!==second)throw new Error('Les deux phrases de passe diffèrent.');return first;
}
const password = await readPassword();
if (password.length < 12) throw new Error('La phrase de passe doit compter au moins 12 caractères.');
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
const args=['node_modules/staticrypt/cli/index.js','private/preview/index.html','--directory','dist','--config','false','--remember','false','--salt',randomBytes(16).toString('hex'),'--template','src/password-template.html'];
if(password.length<14)args.push('--short');
await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,STATICRYPT_PASSWORD:password},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>output+=c);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Échec StatiCrypt : '+output.replaceAll(password,'[masqué]'))));});
await writeFile('dist/.nojekyll','');
await writeFile('dist/robots.txt','User-agent: *\nDisallow: /\n');
const encrypted=await readFile('dist/index.html','utf8');
if(!encrypted.includes('staticryptEncryptedMsgUniqueVariableName'))throw new Error('Sortie non chiffrée.');
for(const card of [...notes, ...cards]) if(encrypted.includes(card.summary)||encrypted.includes(card.oneLiner))throw new Error(`Fuite de fiche en clair : ${card.id}`);
if(encrypted.includes(password))throw new Error('Le mot de passe apparaît dans la sortie.');
await writeFile('private/build-report.json',JSON.stringify({issues:issues.length,cards:cards.length,roundups:roundups.length,workingNotes:notes.length,encrypted:true,files:await readdir('dist')},null,2));
console.log('Publication préparée dans dist/ : contenu chiffré, aucun PDF et aucune fiche en clair.');
