// Runs only inside the documented CUA REPL. Authentication remains in the user's browser.
export async function createAcquisition({reader,cua,fs,write,root}) {
  const catalog=JSON.parse(await fs.readFile(root+'/private/sources/catalog.json','utf8'));
  const idFor=issue=>{const u=new URL(issue.href);return 'epsiloon-'+(u.searchParams.get('titleRef').includes('EPSHS')?'hs-':'')+u.searchParams.get('nb');};
  const existing=await fs.readdir(root+'/private/pdfs');
  const queued=new Set(existing.filter(x=>x.endsWith('.pdf')).map(x=>x.slice(0,-4)));
  const state={issue:null,entries:[],collected:[]};
  const full=()=>reader.getAXState({emit:false,disableDiffing:true});
  const index=(text,pattern)=>{const m=text.match(pattern);if(!m)throw new Error('Contrôle attendu absent');return Number(m[1]);};
  const linkIndex=(text,entity)=>{
    const position=text.indexOf('Value: '+entity),before=position<0?'':text.slice(0,position);
    const matches=[...before.matchAll(/(?:^|\n)\s*(\d+) link\b/g)];
    if(!matches.length)throw new Error('Sujet absent : '+entity);return Number(matches.at(-1)[1]);
  };
  async function dispatch(){
    const tabs=await cua.listTabs({browser:'iab',emit:false}),latest=new Map();
    for(const tab of tabs){if(!tab.url?.includes('/api/user-print/'))continue;const m=(tab.title||'').match(/^Imprimer : Epsiloon( Hors-série)? (\d+)$/i);if(m)latest.set('epsiloon-'+(m[1]?'hs-':'')+m[2],tab.url);}
    const sent=[];
    for(const [name,url] of latest){if(queued.has(name))continue;await fs.writeFile(root+'/private/download.pipe',JSON.stringify({name,url})+'\n');queued.add(name);sent.push(name);}
    if(sent.length)write({exportsQueued:sent});
  }
  async function exportPdf(issue){
    const id=idFor(issue);if(queued.has(id))return;
    if((await reader.url()).split('#')[0]!==issue.href)await reader.goto(issue.href);
    await reader.playwright.getByRole('button',{name:'Sommaire',exact:true}).waitFor({state:'visible'});
    let ax=await full();await reader.click(index(ax,/(?:^|\n)\s*(\d+) container Description: Menu principal/));
    ax=await full();await reader.click(index(ax,/(?:^|\n)\s*(\d+) Imprimer/));
    ax=await full();const all=index(ax,/(?:^|\n)\s*(\d+) radio button[^\n]*Toutes les pages/),submit=index(ax,/(?:^|\n)\s*(\d+) button Imprimer/);
    await reader.click(all);ax=await full();if(!/Toutes les pages, Value: 1/.test(ax))throw new Error('Toutes les pages non sélectionnées');
    await reader.click(submit);await reader.getAXState({emit:false});write({exportRequested:issue.label});
  }
  async function begin(id){
    const issue=catalog.find(x=>idFor(x)===id);if(!issue)throw new Error('Numéro absent du catalogue');
    await exportPdf(issue);
    if((await reader.url()).split('#')[0]!==issue.href)await reader.goto(issue.href);
    await reader.playwright.getByRole('button',{name:'Sommaire',exact:true}).waitFor({state:'visible'});await reader.getAXState({emit:false});
    await reader.playwright.getByRole('button',{name:'Sommaire',exact:true}).click();await reader.getAXState({emit:false});
    const entries=await reader.playwright.evaluate(()=>Array.from(document.querySelectorAll('a[href^="entity://"]')).map(a=>({title:a.getAttribute('aria-label')||a.parentElement.querySelector('h2')?.textContent||'',entity:a.getAttribute('href'),section:a.parentElement.className.replace('elmt_of_section ',''),kind:a.parentElement.querySelector('.entity')?.className||'',preview:a.parentElement.querySelector('.preview')?.textContent||''})));
    const dir=root+'/private/sources/'+id;await fs.mkdir(dir,{recursive:true});await fs.writeFile(dir+'/toc.json',JSON.stringify(entries,null,2));
    state.issue={...issue,id};state.entries=entries.filter(e=>e.kind.includes('story')&&!/ÉDITO|CLUB_|POUR_CE_NUMÉRO|S_ASSOCIENT/.test(e.section));state.collected=[];
    try{state.collected=JSON.parse(await fs.readFile(dir+'/articles.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    await reader.playwright.getByRole('button',{name:'Article',exact:true}).click();await reader.getAXState({emit:false});write({issue:id,subjects:state.entries.length,resumed:state.collected.length});
  }
  async function resume(id){
    const issue=catalog.find(x=>idFor(x)===id),dir=root+'/private/sources/'+id;
    const entries=JSON.parse(await fs.readFile(dir+'/toc.json','utf8'));
    state.issue={...issue,id};state.entries=entries.filter(e=>e.kind.includes('story')&&!/ÉDITO|CLUB_|POUR_CE_NUMÉRO|S_ASSOCIENT/.test(e.section));state.collected=JSON.parse(await fs.readFile(dir+'/articles.json','utf8'));
    await full();write({issue:id,collected:state.collected.length,total:state.entries.length});
  }
  async function collect(limit=25){
    await reader.playwright.getByRole('button',{name:'Article',exact:true}).click();await reader.getAXState({emit:false});
    for(let n=0;n<Math.min(limit,30)&&state.collected.length<state.entries.length;n++){
      const item=state.entries[state.collected.length],ax=await full();await reader.click(linkIndex(ax,item.entity));
      const entityId=item.entity.split('://')[1];
      try{await reader.playwright.locator('main.items article[data-item^="'+entityId+'_"]').first().waitFor({state:'visible',timeoutMs:4000});}
      catch(error){
        const observed=await reader.playwright.evaluate(()=>({title:document.querySelector('main.items h2')?.textContent,items:Array.from(document.querySelectorAll('main.items article[data-item]')).map(a=>a.getAttribute('data-item'))}));
        write({retargeting:item.title,previousTitle:observed.title});
        if(!await reader.playwright.locator('main.items').isVisible()){await reader.playwright.getByRole('button',{name:'Article',exact:true}).click();await reader.getAXState({emit:false});}
        const fresh=await full();await reader.click(linkIndex(fresh,item.entity));await reader.playwright.locator('main.items article[data-item^="'+entityId+'_"]').first().waitFor({state:'visible',timeoutMs:10000});
      }
      await reader.getAXState({emit:false});
      const content=await reader.playwright.evaluate(entityId=>{const node=Array.from(document.querySelectorAll('main.items article[data-item]')).find(a=>a.getAttribute('data-item').startsWith(entityId+'_')),main=node?.closest('.rxe-item-content');return{text:main?.innerText||'',headings:Array.from(main?.querySelectorAll('h2,h3')||[]).map(h=>h.innerText),itemIds:Array.from(main?.querySelectorAll('article[data-item]')||[]).map(a=>a.getAttribute('data-item'))};},entityId);
      if(content.text.length<15)throw new Error('Texte non chargé : '+item.title);
      state.collected.push({...item,...content,issueId:state.issue.id,readerPage:null,sourceUrl:(await reader.url()).split('#')[0]});
      const dir=root+'/private/sources/'+state.issue.id;await fs.writeFile(dir+'/articles.pending.json',JSON.stringify(state.collected,null,2));await fs.rename(dir+'/articles.pending.json',dir+'/articles.json');
    }
    const dir=root+'/private/sources/'+state.issue.id;
    if(state.collected.length===state.entries.length)await fs.writeFile(dir+'/complete.json',JSON.stringify({expected:state.entries.length,collected:state.collected.length,complete:true}));
    write({issue:state.issue.id,collected:state.collected.length,total:state.entries.length,last:state.collected.at(-1)?.title});await dispatch();
  }
  return {begin,resume,collect,dispatch,state,markQueued:id=>queued.add(id)};
}
