import {features, validate} from './engine.mjs';
const $ = id => document.getElementById(id);
const form = $('configuration');
const colors = ['#ff5c69', '#50d879', '#c08aff'];
const colorNames = ['red', 'green', 'purple'];
const shapes = ['squiggle', 'pill', 'diamond'];
const fills = ['solid', 'striped', 'outline'];
const paths = [
  'M-8 -11 C-3 -17 6 -14 7 -8 C9 -1 2 4 6 11 C7 14 3 16 -1 14 C-9 11 -10 5 -7 -1 C-4 -6 -4 -9 -8 -11 Z',
  'M-7 -8 A7 7 0 0 1 7 -8 V8 A7 7 0 0 1 -7 8 Z',
  'M0 -15 L9 0 L0 15 L-9 0 Z'
];
let serial = 0;
let settings = {rows:3, columns:4, min:6, max:6};
let current = {cards:[], sets:[]};
let found = new Set();
let selected = [];
let worker;
function label(id) {
  const [color,shape,fill,count] = features[id];
  return [count+1, fills[fill], colorNames[color], shapes[shape]+(count?'s':'')].join(' ');
}
function art(id) {
  const [color,shape,fill,count] = features[id];
  const ink = colors[color], pattern = 'stripe' + serial++;
  const paint = [ink, 'url(#'+pattern+')', 'none'][fill];
  const symbols = Array.from({length:count+1}, (_,i) =>
    '<path transform="translate('+(46+(i-count/2)*28)+' 18)" d="'+paths[shape]+'" fill="'+paint+'" stroke="'+ink+'" stroke-width="2"/>').join('');
  return '<svg class="art" viewBox="0 0 92 36" aria-hidden="true"><defs><pattern id="'+pattern+'" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><path d="M1 0v4" stroke="'+ink+'" stroke-width="1.5"/></pattern></defs>'+symbols+'</svg>';
}
function progress() {
  $('progress').textContent = found.size+' / '+current.sets.length+' sets found';
}
function choose(id) {
  selected = selected.includes(id) ? selected.filter(x=>x!==id) : [...selected,id];
  if (selected.length === 3) {
    const triple = selected.slice().sort((a,b)=>a-b);
    const key = triple.join(',');
    if (found.has(key)) $('message').textContent = 'Already found. Try another trio.';
    else if (current.sets.some(set=>set.join(',')===key)) {
      if (!found.size) $('found').replaceChildren();
      found.add(key);
      const group = document.createElement('div');
      group.className = 'trio';
      group.setAttribute('role','img');
      group.setAttribute('aria-label', triple.map(label).join(', '));
      group.innerHTML = triple.map(art).join('');
      $('found').append(group);
      $('message').textContent = found.size===current.sets.length ? 'Puzzle complete. You found every set!' : 'Set found!';
      progress();
    } else $('message').textContent = 'Try again. Check each feature for a pair and an odd one out.';
    selected = [];
  } else $('message').textContent = selected.length ? selected.length+' of 3 cards selected.' : 'Choose three cards.';
  for (const card of $('board').children) card.setAttribute('aria-pressed', selected.includes(Number(card.value)));
}
function showBoard(result, options) {
  current = result;
  settings = options;
  selected = [];
  found = new Set();
  $('board').style.setProperty('--cols', settings.columns);
  $('layout').textContent = settings.rows+' × '+settings.columns+' board';
  $('found').textContent = 'Your discovered trios appear here.';
  $('board').replaceChildren(...current.cards.map(id=>{
    const card = document.createElement('button');
    card.className = 'card';
    card.value = id;
    card.setAttribute('aria-label', label(id));
    card.setAttribute('aria-pressed','false');
    card.innerHTML = art(id);
    card.onclick = ()=>choose(id);
    return card;
  }));
  progress();
  $('message').textContent = current.sets.length ? 'Choose three cards.' : 'Puzzle complete. This board has zero sets.';
}
function deal(options) {
  worker?.terminate();
  $('message').textContent = 'Finding a matching puzzle…';
  worker = new Worker('./generator.js',{type:'module'});
  worker.onmessage = ({data})=>{
    if (data.error) $('message').textContent = data.error;
    else showBoard(data, options);
    worker.terminate();
  };
  worker.onerror = ()=>{ $('message').textContent = 'Could not load the generator. Reload to try again.'; worker.terminate(); };
  worker.postMessage(options);
}
for (const name of ['rows','columns']) for (const n of [2,3,4,5]) form.elements[name].add(new Option(n,n));
$('settings').onclick = ()=>{
  for (const [key,value] of Object.entries(settings)) form.elements[key].value = value;
  $('issue').textContent = '';
  $('options').showModal();
};
function readOptions() {
  return Object.fromEntries(Array.from(new FormData(form), ([key,v])=>[key, v==='' ? NaN : Number(v)]));
}
form.oninput = ()=>{ $('issue').textContent = validate(readOptions()); };
form.onsubmit = event=>{
  event.preventDefault();
  const options = readOptions();
  const error = validate(options);
  $('issue').textContent = error;
  if (error) return;
  $('options').close();
  deal(options);
};
$('cancel').onclick = ()=>$('options').close();
$('help').onclick = ()=>$('rules').showModal();
$('deal').onclick = ()=>deal(settings);
deal(settings);