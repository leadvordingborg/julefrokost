import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import { getFirestore, collection, addDoc, deleteDoc, doc, getDoc, setDoc, onSnapshot, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';

// Firebase-konfiguration til julefrokost-30e8d (allerede udfyldt).
const firebaseConfig = {
  apiKey: 'AIzaSyAPJghBLjaaA7r1CQW2SFqMrKtSHkgqF8g',
  authDomain: 'julefrokost-30e8d.firebaseapp.com',
  projectId: 'julefrokost-30e8d',
  storageBucket: 'julefrokost-30e8d.firebasestorage.app',
  messagingSenderId: '707518291596',
  appId: '1:707518291596:web:d972074e3f212558caa5a9'
};

const categories = [
  { title: '🐟 Fisk og pålæg', dishes: ['Marinerede sild – 3 glas', 'Karrysalat', 'Fiskefilet', 'Remoulade', 'Rejer', 'Æg', 'Leverpostej', 'Bacon', 'Champignon', 'Frikadeller', 'Flæskesteg', 'Rødkål', 'Medisterpølse', 'Tunsalat', 'Laks med tilbehør', 'Tarteletter'] },
  { title: '🥖 Brød og tilbehør', dishes: ['Rugbrød', 'Franskbrød', 'Smør', 'Mayonnaise', 'Ristede løg', 'Citron', 'Dild og karse – et par bundter'] },
  { title: '🧀 Ost og snacks', dishes: ['Ost', 'Kiks', 'Vindruer', 'Chips', 'Nødder', 'Clementiner'] },
  { title: '🍰 Dessert', dishes: ['Risalamande', 'Kirsebærsovs', 'Jordbærsovs', 'Småkager', 'Chokolade', 'Frugtsalat'] }
];
// Allerede aftalt i familietråden. Importeres én gang af arrangøren.
const agreed = [
  ['Litha', 'Tunsalat'], ['Litha', 'Rejer med tilbehør'], ['Litha', 'Laks med tilbehør'],
  ['Litha', 'Ost'], ['Litha', 'Kiks'], ['Litha', 'Frugtsalat'], ['Litha', 'Marinerede sild – 3 glas'],
  ['Søren', 'Fiskefilet med remoulade og citron'], ['Moster', 'Tarteletter'],
  ['Michala og Alexander', 'Risalamande'], ['Michala og Alexander', 'Kirsebærsovs'],
  ['Michala og Alexander', 'Jordbærsovs'], ['Michala og Alexander', 'Frikadeller'],
  ['Cecilia', 'Æg'], ['Cecilia', 'Leverpostej'], ['Cecilia', 'Bacon'], ['Cecilia', 'Champignon'],
  ['Jonas', 'Brød'], ['Jonas', 'Smør']
];
const icons = ['🍽️','🥔','🥗','🧀','🍞','🐟','🥧','🍰','🥤','🎄'];
const $ = (id) => document.getElementById(id);
const select = $('dish-select');
const customRow = $('custom-row');
const customInput = $('custom-dish');
const nameInput = $('guest-name');
const form = $('signup-form');
const formMessage = $('form-message');
const listEl = $('contribution-list');
const loadingEl = $('loading');
const emptyEl = $('empty-state');
let db, auth, contributions = [], isAdmin = false, firebaseReady = false;

function setMessage(el, message, success = false) {
  el.textContent = message;
  el.style.color = success ? '#286c42' : '';
}
function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function populateDishOptions() {
  select.innerHTML = '<option value="" selected disabled>Vælg en ret …</option>' +
    categories.map(category => `<optgroup label="${escapeText(category.title)}">${category.dishes.map(d => `<option value="${escapeText(d)}">${escapeText(d)}</option>`).join('')}</optgroup>`).join('') +
    '<option value="__custom__">＋ Jeg vil oprette en ny ret …</option>';
}
function renderSuggestions() {
  const taken = new Set(contributions.map(x => x.dish.toLocaleLowerCase('da')));
  const el = $('suggestions');
  el.innerHTML = '';
  for (const category of categories) {
    const section = document.createElement('section');
    section.className = 'suggestion-group';
    const heading = document.createElement('h3'); heading.textContent = category.title; section.appendChild(heading);
    const chips = document.createElement('div'); chips.className = 'suggestion-chips';
    for (const dish of category.dishes) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'suggestion-chip';
      button.textContent = dish + (taken.has(dish.toLocaleLowerCase('da')) ? ' ✓' : ' ＋');
      button.addEventListener('click', () => {
        select.value = dish; setCustomMode(false); $('toggle-custom').textContent = '＋ Opret en ny ret';
        $('signup-heading').scrollIntoView({behavior:'smooth',block:'start'}); nameInput.focus();
      });
      chips.appendChild(button);
    }
    section.appendChild(chips); el.appendChild(section);
  }
}
function setCustomMode(on) {
  customRow.hidden = !on;
  customInput.required = on;
  if (on) { select.value = '__custom__'; customInput.focus(); }
  else { customInput.value = ''; if (select.value === '__custom__') select.value = ''; }
}
function updateDishMode() { setCustomMode(select.value === '__custom__'); }
select.addEventListener('change', updateDishMode);
$('toggle-custom').addEventListener('click', () => {
  const next = customRow.hidden;
  setCustomMode(next);
  $('toggle-custom').textContent = next ? '↩ Vælg en fast ret' : '＋ Opret en ny ret';
});
function renderList() {
  loadingEl.hidden = true;
  $('total-count').textContent = contributions.length;
  emptyEl.hidden = contributions.length !== 0;
  listEl.innerHTML = '';
  renderSuggestions();
  const sorted = [...contributions].sort((a,b) => a.dish.localeCompare(b.dish, 'da') || a.name.localeCompare(b.name, 'da'));
  for (const item of sorted) {
    const card = document.createElement('article');
    card.className = 'contribution';
    const icon = icons[Math.abs([...item.dish].reduce((sum,c) => sum + c.charCodeAt(0), 0)) % icons.length];
    card.innerHTML = `<div class="contribution-main"><div class="dish-icon" aria-hidden="true">${icon}</div><div class="dish-info"><strong>${escapeText(item.dish)}</strong><span>${escapeText(item.name)}</span></div></div>`;
    if (isAdmin) {
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'delete-button'; del.textContent = 'Slet';
      del.setAttribute('aria-label', `Slet ${item.dish}, tilmeldt af ${item.name}`);
      del.addEventListener('click', async () => {
        if (!confirm(`Vil du slette tilmeldingen “${item.dish} — ${item.name}”?`)) return;
        try { await deleteDoc(doc(db, 'contributions', item.id)); }
        catch (err) { alert('Tilmeldingen kunne ikke slettes. Kontrollér, at du er logget ind som arrangør.'); console.error(err); }
      });
      card.appendChild(del);
    }
    listEl.appendChild(card);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(formMessage, '');
  if (!firebaseReady) { setMessage(formMessage, 'Hjemmesiden mangler Firebase-opsætning. Følg vejledningen i README-filen.'); return; }
  const name = nameInput.value.trim();
  const dish = select.value === '__custom__' ? customInput.value.trim() : select.value;
  if (!name) { setMessage(formMessage, 'Skriv dit navn, før du tilmelder dig.'); nameInput.focus(); return; }
  if (!dish || dish === '__custom__') { setMessage(formMessage, 'Vælg en ret eller skriv navnet på en ny ret.'); return; }
  if (name.length > 60 || dish.length > 80) { setMessage(formMessage, 'Navnet eller retten er for langt.'); return; }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true; submit.textContent = 'Tilføjer …';
  try {
    await addDoc(collection(db, 'contributions'), { name, dish, createdAt: serverTimestamp() });
    nameInput.value = '';
    if (select.value === '__custom__') { select.value = ''; customInput.value = ''; setCustomMode(false); $('toggle-custom').textContent = '＋ Opret en ny ret'; }
    else select.value = '';
    setMessage(formMessage, `Tak ${name}! Du er skrevet på til ${dish}.`, true);
  } catch (err) {
    console.error(err); setMessage(formMessage, 'Kunne ikke gemme tilmeldingen. Prøv igen om lidt.');
  } finally { submit.disabled = false; submit.innerHTML = '<span>＋</span> Tilføj mig på listen'; }
});

$('admin-toggle').addEventListener('click', () => {
  $('admin-form').hidden = !$('admin-form').hidden;
  if (!$('admin-form').hidden) $('admin-email').focus();
});
$('admin-cancel').addEventListener('click', () => { $('admin-form').hidden = true; setMessage($('admin-message'), ''); });
$('admin-form').addEventListener('submit', async (event) => {
  event.preventDefault(); setMessage($('admin-message'), '');
  try {
    await signInWithEmailAndPassword(auth, $('admin-email').value.trim(), $('admin-password').value);
    $('admin-password').value = '';
    $('admin-form').hidden = true;
  } catch (err) {
    console.error(err); setMessage($('admin-message'), 'Login mislykkedes. Tjek e-mail og adgangskode.');
  }
});
$('admin-logout').addEventListener('click', () => signOut(auth));
$('import-agreed').addEventListener('click', async () => {
  const button = $('import-agreed');
  const status = $('import-message');
  status.textContent = 'Starter import …';
  if (!isAdmin || !db) {
    status.textContent = 'Du skal være logget ind som arrangør, og Firebase skal være forbundet.';
    return;
  }
  if (!confirm('Vil du indlæse de 19 aftalte retter? Allerede eksisterende tilmeldinger springes over.')) {
    status.textContent = 'Import annulleret.';
    return;
  }
  button.disabled = true;
  let created = 0, skipped = 0;
  try {
    // Brug addDoc i stedet for faste dokument-ID'er. Dette matcher gæsternes
    // oprettelsesmetode og Firestore-reglerne. Undgå dubletter via navn + ret.
    for (const [name, dish] of agreed) {
      if (contributions.some(x => x.name.toLocaleLowerCase('da') === name.toLocaleLowerCase('da') && x.dish.toLocaleLowerCase('da') === dish.toLocaleLowerCase('da'))) {
        skipped++;
        continue;
      }
      status.textContent = `Indlæser ${created + skipped + 1} af ${agreed.length}: ${dish} …`;
      await addDoc(collection(db, 'contributions'), { name, dish, createdAt: serverTimestamp() });
      // Opdatér lokalt med det samme for at undgå dubletter, hvis snapshot er forsinket.
      contributions.push({name, dish});
      created++;
    }
    status.textContent = `Færdig! ${created} retter indlæst, ${skipped} fandtes allerede.`;
    renderList();
  } catch (err) {
    console.error('Importfejl:', err);
    status.textContent = `Import stoppede efter ${created} retter. Firebase-fejl: ${err.code || err.message || 'Ukendt fejl'}.`;
  } finally {
    button.disabled = false;
  }
});


function initFirebase() {
  const configMissing = Object.values(firebaseConfig).some(v => String(v).startsWith('INDSÆT_'));
  if (configMissing) {
    loadingEl.hidden = true;
    emptyEl.hidden = false;
    emptyEl.querySelector('h3').textContent = 'Hjemmesiden er næsten klar';
    emptyEl.querySelector('p').textContent = 'Arrangøren skal først indsætte Firebase-oplysningerne. Se README-filen.';
    form.querySelector('button[type="submit"]').disabled = true;
    $('toggle-custom').disabled = true;
    return;
  }
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app); auth = getAuth(app); firebaseReady = true;
    const q = query(collection(db, 'contributions'), orderBy('createdAt', 'asc'));
    onSnapshot(q, snapshot => {
      contributions = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => typeof d.name === 'string' && typeof d.dish === 'string');
      renderList();
    }, err => {
      console.error(err); loadingEl.hidden = true; emptyEl.hidden = false;
      emptyEl.querySelector('h3').textContent = 'Kunne ikke hente madlisten';
      emptyEl.querySelector('p').textContent = 'Tjek Firebase-opsætningen og Firestore-reglerne.';
    });
    onAuthStateChanged(auth, user => {
      isAdmin = !!user && (user.email || '').toLowerCase() === 'alexander.madsen@me.com';
      $('admin-status').hidden = !isAdmin;
      $('admin-toggle').hidden = isAdmin;
      renderList();
    });
  } catch (err) {
    console.error(err); loadingEl.hidden = true;
    setMessage(formMessage, 'Firebase kunne ikke startes. Tjek opsætningen i app.js.');
  }
}
populateDishOptions();
initFirebase();
