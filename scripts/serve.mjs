import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const plaintext = process.argv.includes('--plaintext');
const root = path.resolve(plaintext ? 'private/preview' : 'dist');
const port = Number(process.env.PORT || 4173);
const server = createServer(async (req,res) => {
  const url=new URL(req.url,'http://localhost'),name=decodeURIComponent(url.pathname);
  if(!['/','/index.html','/robots.txt','/.nojekyll'].includes(name)){res.writeHead(404);res.end('Introuvable');return;}
  try{const file=name==='/'?'index.html':name.slice(1),data=await readFile(path.join(root,file));res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(data);}catch{res.writeHead(404);res.end('Construis le carnet avant de lancer l’aperçu.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://localhost:${port}${plaintext ? ' (aperçu local en clair)' : ''}`));
