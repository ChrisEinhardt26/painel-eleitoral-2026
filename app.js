const $=id=>document.getElementById(id);
let tab='estados',current=null,baseline=null;
const fmt=n=>new Intl.NumberFormat('pt-BR').format(n||0);
const pct=n=>`${n.toFixed(2).replace('.',',')}%`;
const total=arr=>arr.reduce((a,s)=>a+s,0);

function aggregate(states,label){
  const a={
    label,
    sections:total(states.map(s=>s.sections)),
    sectionsTotal:total(states.map(s=>s.sectionsTotal)),
    votes:total(states.map(s=>s.votes)),
    blue:total(states.map(s=>s.candidates.find(c=>c.number===22)?.votes||0)),
    red:total(states.map(s=>s.candidates.find(c=>c.number===13)?.votes||0))
  };
  a.bluePct=a.votes?100*a.blue/a.votes:0;
  a.redPct=a.votes?100*a.red/a.votes:0;
  return a;
}

function groups(data){
  if(!data)return[];
  if(tab==='estados')return data.states.filter(s=>s.uf!=='ZZ').map(s=>aggregate([s],s.uf));
  if(tab==='regioes')return ['Norte','Nordeste','Centro-Oeste','Sudeste','Sul'].map(r=>aggregate(data.states.filter(s=>s.region===r),r));
  return [aggregate(data.states,'Brasil (inclui exterior)')];
}

function comparison(a,b){
  if(a.sections===0 || a.votes===0)return 'Aguardando início da apuração do 2º turno.';
  if(!b?.votes)return 'Comparação com 1º turno indisponível';
  const denominator=b.blue+b.red;
  if(!denominator)return 'Referência indisponível';
  const normalized=100*b.blue/denominator;
  const diff=a.bluePct-normalized;
  return `Flávio: ${diff>=0?'+':''}${diff.toFixed(2).replace('.',',')} p.p. frente à participação entre os dois candidatos no 1º turno (Lula: ${diff<=0?'+':''}${(-diff).toFixed(2).replace('.',',')} p.p.)`;
}

function analysisStyles(){
  if(document.getElementById('analysis-styles'))return;
  const st=document.createElement('style');st.id='analysis-styles';
  st.textContent=`.analysis-wrap{display:grid;gap:18px}.analysis-card{background:#17243b;border:1px solid #30415e;border-radius:14px;padding:22px}.analysis-title{font-size:19px;font-weight:750;margin:0 0 14px}.analysis-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:14px}.analysis-number{font-size:27px;font-weight:750;margin:9px 0}.analysis-note{color:#bac9e3;font-size:13px;line-height:1.6}.analysis-line{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:10px 0}.analysis-row{border-top:1px solid #30415e;padding:13px 0}.analysis-row:first-of-type{border-top:0}.analysis-warn{border-left:3px solid #9db3d6;padding:12px 15px;background:#1b2c47;border-radius:5px}.analysis-pill{display:inline-block;background:#2b4166;border-radius:20px;padding:4px 10px;font-size:12px}.analysis-label{color:#c3d0e4;font-size:13px}`;
  document.head.append(st);
}
function analyze(){
  analysisStyles();
  $('heading').textContent='Análise da Apuração';
  $('metrics').innerHTML='';
  $('content').innerHTML='';
  if(!current?.states?.length){$('content').textContent='Aguardando dados oficiais do segundo turno.';return;}
  const all=aggregate(current.states,'Brasil');
  const old=baseline?.states||[];
  const hasBase=old.length>0 && old.every(s=>s.sectionsTotal>0);
  const done=all.sectionsTotal>0 && all.sections>=all.sectionsTotal;
  const started=all.sections>0 && all.votes>0;
  const remainingSections=Math.max(0,all.sectionsTotal-all.sections);
  // Hipótese explícita: cada seção restante teria o mesmo número médio de votos válidos
  // que as seções do mesmo estado no primeiro turno.
  const estimate=hasBase?current.states.reduce((acc,s)=>{
    const b=old.find(x=>x.uf===s.uf);
    if(!b || !b.sectionsTotal)return acc;
    const rem=Math.max(0,s.sectionsTotal-s.sections);
    const projected=rem*(b.votes/b.sectionsTotal);
    const two=b.candidates.reduce((n,c)=>n+([13,22].includes(c.number)?c.votes:0),0);
    const blueShare=two?b.candidates.find(c=>c.number===22).votes/two:0.5;
    acc.votes+=projected;
    acc.blue+=projected*blueShare;
    return acc;
  },{votes:0,blue:0}):null;
  const rem=estimate?.votes||0;
  const gap=all.blue-all.red;
  const shareNeed=rem>0?100*(rem-gap)/(2*rem):null;
  const neededBlue=shareNeed===null?'—':shareNeed<=0?'Vantagem mantida mesmo com 0%':shareNeed>100?'Acima de 100%':pct(shareNeed);
  const neededRed=shareNeed===null?'—':shareNeed>=100?'Vantagem mantida mesmo com 0%':shareNeed<0?'Acima de 100%':pct(100-shareNeed);
  const root=document.createElement('div');root.className='analysis-wrap';
  const card=(title,body)=>{const el=document.createElement('section');el.className='analysis-card';const h=document.createElement('h3');h.className='analysis-title';h.textContent=title;el.append(h);const c=document.createElement('div');c.innerHTML=body;el.append(c);root.append(el)};
  const advantage=gap>0?'Flávio Bolsonaro':gap<0?'Lula':'Empate em votos';
  card('Situação atual',`<div class="analysis-grid"><div><div class="analysis-label">Seções totalizadas</div><div class="analysis-number">${pct(all.sectionsTotal?100*all.sections/all.sectionsTotal:0)}</div><div class="analysis-note">${fmt(all.sections)} de ${fmt(all.sectionsTotal)}</div></div><div><div class="analysis-label">Diferença atual de votos</div><div class="analysis-number">${fmt(Math.abs(gap))}</div><div class="analysis-note">${started?advantage:'Apuração ainda não iniciada'}</div></div><div><div class="analysis-label">Votos válidos apurados</div><div class="analysis-number">${fmt(all.votes)}</div><div class="analysis-note">Flávio ${pct(all.bluePct)} · Lula ${pct(all.redPct)}</div></div></div>`);
  if(!started){card('Aguardando a apuração','<p>A análise dos votos restantes e os cenários ficarão disponíveis após a divulgação dos primeiros votos do segundo turno.</p>');}
  else if(!hasBase){card('Referência indisponível','<p>Não foi possível carregar todos os dados do primeiro turno. Os cenários permanecem desativados para evitar números enganosos.</p>');}
  else {
    card('Votos necessários para ultrapassar',`<p class="analysis-note">Hipótese de votos restantes: <b>${fmt(Math.round(rem))}</b> votos válidos, estimados pela média de votos válidos por seção do 1º turno em cada UF.</p><div class="analysis-row"><div class="analysis-line"><span class="blue">Flávio Bolsonaro</span><strong>${done?'Apuração concluída':neededBlue}</strong></div></div><div class="analysis-row"><div class="analysis-line"><span class="red">Lula</span><strong>${done?'Apuração concluída':neededRed}</strong></div></div><p class="analysis-note">Percentual dos votos válidos ainda não apurados necessário para ultrapassar o adversário, supondo apenas dois candidatos e o volume estimado acima. Não é uma chance de vitória.</p>`);
    const baseShare=rem>0?estimate.blue/rem:0.5;
    const scenarios=[['Padrão do 1º turno',baseShare],['5 p.p. a mais para Flávio',Math.min(1,baseShare+0.05)],['5 p.p. a mais para Lula',Math.max(0,baseShare-0.05)]];
    const lines=scenarios.map(([name,sh])=>{const b=all.blue+rem*sh,r=all.red+rem*(1-sh),den=b+r;return `<div class="analysis-row"><div class="analysis-line"><strong>${name}</strong><span class="analysis-pill">Hipótese</span></div><div class="analysis-line"><span class="blue">Flávio: ${pct(den?100*b/den:0)}</span><span class="red">Lula: ${pct(den?100*r/den:0)}</span></div><div class="analysis-note">Totais hipotéticos: ${fmt(Math.round(b))} × ${fmt(Math.round(r))} votos</div></div>`}).join('');
    card('Cenários condicionais',`${lines}<p class="analysis-note">Os cenários aplicam a distribuição entre os dois candidatos no 1º turno de cada UF aos votos restantes estimados. As variações de ±5 p.p. são hipóteses ilustrativas, não projeções estatísticas.</p>`);
  }
  card('Metodologia e limites',`<div class="analysis-warn">Este painel não calcula probabilidade de vitória nem antecipa resultado oficial.</div><p class="analysis-note">Fonte: arquivos EA20 do TSE, 1º e 2º turnos. A quantidade de votos ainda não apurados não é informada diretamente por este painel; ela é aproximada multiplicando as seções restantes de cada UF pela média de votos válidos por seção do primeiro turno. A participação de Flávio e Lula no 1º turno é normalizada apenas entre os dois. A distribuição dos votos restantes pode ser muito diferente da histórica, a quantidade de eleitores por seção varia, e comparecimento e votos inválidos podem mudar. Seções totalizadas não equivalem a percentual exato de votos. As simulações são condicionais e podem variar substancialmente conforme chegam novos dados.</p><p class="analysis-note">Dados consultados em: ${new Date(current.retrievedAt).toLocaleString('pt-BR')}. ${current.complete?'Todas as unidades responderam.':'Atenção: há unidades sem resposta; a análise pode estar incompleta.'}</p>`);
  $('content').append(root);
}
function render(){
  if(tab==='analise'){analyze();return;}
  const rows=groups(current),old=groups(baseline);
  $('heading').textContent={estados:'Apuração por estado',regioes:'Apuração por região',total:'Total Brasil'}[tab];
  $('metrics').innerHTML='';
  $('content').innerHTML='';
  if(!rows.length){
    $('content').innerHTML='<div class="empty">Nenhum dado oficial disponível nesta consulta. O painel não exibe números simulados.</div>';
    return;
  }
  const nat=aggregate(current.states,'Brasil');
  const cards=[
    ['Seções totalizadas',`${fmt(nat.sections)} / ${fmt(nat.sectionsTotal)}`],
    ['Flávio Bolsonaro',`${fmt(nat.blue)} · ${pct(nat.bluePct)}`],
    ['Lula',`${fmt(nat.red)} · ${pct(nat.redPct)}`]
  ];
  cards.forEach(([name,value],i)=>{
    const c=document.createElement('div');
    c.className='metric';
    c.innerHTML=`<span>${name}</span><strong class="${i===1?'blue':i===2?'red':''}">${value}</strong>`;
    $('metrics').append(c);
  });
  rows.forEach(r=>{
    const prior=old.find(x=>x.label===r.label);
    const el=document.createElement('div');
    el.className='entry';
    el.innerHTML=`<div class="entry-head"><b>${r.label}</b><small>${fmt(r.sections)} / ${fmt(r.sectionsTotal)} seções · ${r.sectionsTotal?pct(100*r.sections/r.sectionsTotal):'—'} apurado</small></div><div class="bars"><div class="b" style="width:${r.bluePct}%"></div><div class="r" style="width:${r.redPct}%"></div></div><div class="sub"><span class="blue">Flávio ${pct(r.bluePct)} · ${fmt(r.blue)}</span><span class="red">Lula ${pct(r.redPct)} · ${fmt(r.red)}</span></div><div class="delta">${comparison(r,prior)}</div>`;
    $('content').append(el);
  });
}

async function load(){
  try{
    const [r1,r2]=await Promise.allSettled([
      fetch('/api/results?turn=1',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error((await r.json()).error);return r.json()}),
      fetch('/api/results?turn=2',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error((await r.json()).error);return r.json()})
    ]);
    if(r1.status==='fulfilled')baseline=r1.value;
    if(r2.status==='fulfilled')current=r2.value;
    const error=r2.status==='rejected'?r2.reason.message:null;
    $('status').textContent=current?'Dados oficiais carregados':'Sem dados oficiais';
    $('updated').textContent=current?'Consulta: '+new Date(current.retrievedAt).toLocaleString('pt-BR'):'';
    $('notice').textContent=error?`Atualização não concluída: ${error}. ${current?'Exibindo última consulta bem-sucedida.':''}`:current?.errors.length?`Atenção: ${current.errors.length} UFs não responderam. Totais são parciais.`:'Dados oficiais recebidos. Próxima consulta em 30 segundos.';
    render();
  }catch(e){$('notice').textContent='Falha: '+e.message}
}
// Acrescenta a quarta aba sem exigir alteração no index.html.
const nav=document.querySelector('nav');
if(nav && !nav.querySelector('[data-tab="analise"]')){
  const btn=document.createElement('button');btn.type='button';btn.dataset.tab='analise';btn.textContent='Análise da Apuração';nav.append(btn);
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  tab=b.dataset.tab;
  document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x===b));
  render();
});
load();
setInterval(load,30000);
