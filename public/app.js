import {features, validate, solutions} from './engine.mjs';
const $ = id => document.getElementById(id);
const form = $('configuration');
const colors = ['#ff5c69', '#50d879', '#c08aff'];
const colorNames = ['red', 'green', 'purple'];
const shapes = ['squiggle', 'pill', 'diamond'];
const fills = ['solid', 'striped', 'outline'];
const paths = [
  'M-6.8 -12.5 C-6.6 -15.8 0.5 -15.4 4.1 -12.1 C8.6 -8 7.7 -2.9 5.7 2.4 C4.1 6.8 5.2 9.1 7.1 12 C8.5 14.5 5.1 15.4 1 14.9 C-6.4 14.3 -8.3 10.2 -7.4 4.7 C-6.7 0.1 -3.6 -3.9 -4.3 -7.2 C-4.8 -9.7 -7 -11.1 -6.8 -12.5 Z',
  'M-7 -8 A7 7 0 0 1 7 -8 V8 A7 7 0 0 1 -7 8 Z',
  'M0 -15 L9 0 L0 15 L-9 0 Z'
];
let serial = 0;
let settings = {rows:3, columns:4, min:6, max:6};
let current = {cards:[], sets:[]};
let found = new Set();
let selected = [];
let worker;
let ticker;
let startedAt;
let pausedAt = null;
function resumeClock() {
  if (pausedAt === null) return;
  startedAt += performance.now() - pausedAt;
  pausedAt = null;
  document.body.classList.remove('paused');
}
$('pause').onclick = () => {
  if (finished || pausedAt !== null) return;
  pausedAt = performance.now();
  $('timer').textContent = formatTime(pausedAt - startedAt);
  document.body.classList.add('paused');
  $('paused').showModal();
};
$('paused').onclose = resumeClock;
let finished = false;
let pendingIcons = '';
let splits = [];
let challengeId;

function formatTime(milliseconds) {
  const ms = Math.floor(milliseconds);
  const seconds = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
  return Math.floor(ms / 60000) + ':' + seconds + '.' + String(ms % 1000).padStart(3, '0');
}

// The ID stores the column count followed by card IDs in display order.
function encodeBoard(columns, cards) {
  return btoa(String.fromCharCode(columns, ...cards)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
function sharedBoard(id) {
  if (!/^[A-Za-z0-9_-]{7,35}$/.test(id)) return null;
  let bytes;
  try { bytes = Array.from(atob(id.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0)); }
  catch { return null; }
  const [columns, ...cards] = bytes;
  const rows = cards.length / columns;
  if (validate({rows, columns, min:0, max:0}) || cards.some(card => card >= 81) ||
      new Set(cards).size !== cards.length || encodeBoard(columns, cards) !== id) return null;
  const sets = solutions(cards);
  return {board:{cards, sets}, options:{rows, columns, min:sets.length, max:sets.length}};
}
function finish(elapsed) {
  finished = true;
  $('pause').disabled = true;
  clearInterval(ticker);
  $('timer').textContent = formatTime(elapsed);
  $('finishTime').textContent = 'Finished in ' + formatTime(elapsed);
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('puzzle', challengeId);
  $('result').value = ['Infinite set puzzle ' + challengeId, splits.join('\n'), url.href].filter(Boolean).join('\n\n');
  $('copyStatus').textContent = '';
  $('review').hidden = false;
  $('win').showModal();
}
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
  if (finished || pausedAt !== null) return;
  selected = selected.includes(id) ? selected.filter(x=>x!==id) : [...selected,id];
  if (selected.length === 3) {
    const triple = selected.slice().sort((a,b)=>a-b);
    const key = triple.join(',');
    if (found.has(key)) {
      pendingIcons += '♻️';
      $('message').textContent = 'Already found. Try another trio.';
    }
    else if (current.sets.some(set=>set.join(',')===key)) {
      if (!found.size) $('found').replaceChildren();
      const elapsed = performance.now() - startedAt;
      splits.push(pendingIcons + '🟩 ' + formatTime(elapsed));
      pendingIcons = '';
      found.add(key);
      const group = document.createElement('div');
      group.className = 'trio';
      group.setAttribute('role','img');
      group.setAttribute('aria-label', triple.map(label).join(', '));
      group.innerHTML = triple.map(art).join('');
      $('found').append(group);
      $('message').textContent = found.size===current.sets.length ? 'Puzzle complete. You found every set!' : 'Set found!';
      progress();
      if (found.size === current.sets.length) finish(elapsed);
    } else {
      pendingIcons += '❌';
      $('message').textContent = 'Try again. Check each feature for a pair and an odd one out.';
    }
    selected = [];
  } else $('message').textContent = selected.length ? selected.length+' of 3 cards selected.' : 'Choose three cards.';
  for (const card of $('board').children) card.setAttribute('aria-pressed', selected.includes(Number(card.value)));
}
function showBoard(result, options) {
  clearInterval(ticker);
  if ($('win').open) $('win').close();
  if ($('paused').open) $('paused').close();
  resumeClock();
  $('pause').disabled = false;
  finished = false;
  pendingIcons = '';
  splits = [];
  $('review').hidden = true;
  challengeId = encodeBoard(options.columns, result.cards);
  const url = new URL(location.href);
  url.searchParams.set('puzzle', challengeId);
  history.replaceState(null, '', url);
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
  startedAt = performance.now();
  $('timer').textContent = formatTime(0);
  if (!current.sets.length) finish(0);
  else ticker = setInterval(() => { if (pausedAt === null) $('timer').textContent = formatTime(performance.now() - startedAt); }, 40);
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
$('dismiss').onclick = () => $('win').close();
$('review').onclick = () => $('win').showModal();
$('copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('result').value);
    $('copyStatus').textContent = 'Result copied.';
  } catch {
    $('result').focus();
    $('result').select();
    $('copyStatus').textContent = 'Result selected. Use your device’s copy command.';
  }
};
const requested = new URL(location.href).searchParams.get('puzzle');
const shared = requested && sharedBoard(requested);
if (shared) showBoard(shared.board, shared.options);
else if (requested !== null) $('message').textContent = 'Invalid challenge link. Choose New puzzle to start a fresh board.';
else deal(settings);
