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
const bringCustom = $('bring-custom');
const submitButton = $('signup-submit');
const form = $('signup-form');
const formMessage = $('form-message');
const listEl = $('contribution-list');
const loadingEl = $('loading');
const emptyEl = $('empty-state');
let db, auth, contributions = [], extraSuggestions = [], hiddenSuggestions = new Set(), isAdmin = false, firebaseReady = false;

function setMessage(el, message, success = false) {
  el.textContent = message;
  el.style.color = success ? '#286c42' : '';
}
function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Forslag med andre betegnelser end de aftalte retter tæller også som optaget.
const dishAliases = {
  'fiskefilet': ['fiskefilet med remoulade og citron'],
  'remoulade': ['fiskefilet med remoulade og citron'],
  'citron': ['fiskefilet med remoulade og citron'],
  'rejer': ['rejer med tilbehør'],
  'rugbrød': ['brød'],
  'franskbrød': ['brød'],
  'marinerede sild – 3 glas': ['marinerede sild – 3 glas']
};
function normalizedDish(value) { return String(value).trim().toLocaleLowerCase('da'); }
function isTaken(dish) {
  const names = [dish, ...(dishAliases[normalizedDish(dish)] || [])].map(normalizedDish);
  return contributions.some(item => names.includes(normalizedDish(item.dish)));
}
// Lokal, deterministisk sortering: ingen ekstern AI eller ekstra tjenester.
// Ukendte retter går i Andre forslag i stedet for at blive gættet forkert.
function categoryForDish(dish) {
  const value = normalizedDish(dish).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const exact = categories.find(c => c.dishes.some(d => normalizedDish(d) === normalizedDish(dish)));
  if (exact) return exact.title;
  const rules = [
    ['🍰 Dessert', /slik|bolsje|karamel|lakrids|vingummi|chokolade|konfekt|marcipan|nougat|dessert|kage|smakag|småkag|brownie|cookie|islagkage|risalamande|frugtsalat|jordbar|kirsebar|sovs til dessert|pandekag|aebleskiv|æbleskiv|flodeskum|flødeskum|panna cotta|mousse|tiramisu|budding/],
    ['🥖 Brød og tilbehør', /rugbrod|rugbrød|franskbrod|franskbrød|brod|brød|baguette|flute|bolle|smor|smør|mayonnaise|mayo|remoulade|dressing|sennep|ristede log|ristede løg|citron|dild|karse|syltede|tilbehor|tilbehør/],
    ['🧀 Ost og snacks', /ost|kiks|chips|snack|nodder|nødder|mandler|vindru|clementin|klementin|popcorn|saltstang|peanut|oliven/],
    ['🐟 Fisk og pålæg', /sild|fisk|reje|laks|tun|skinke|pat[eé]|leverpostej|bacon|champignon|frikadell|flaskesteg|flæskesteg|rodka|rødkå|medister|tartelet|salat|æg|aeg|kylling|and|paleg|pålæg|roastbeef|hamburgerryg/],
  ];
  return rules.find(([,pattern]) => pattern.test(value))?.[0] || '💡 Andre forslag';
}
function availableCategories() {
  const base = categories.map(cat => ({ ...cat, dishes: cat.dishes.filter(d => !isTaken(d) && !hiddenSuggestions.has(normalizedDish(d))) }));
  const known = new Set(categories.flatMap(cat => cat.dishes).map(normalizedDish));
  for (const item of extraSuggestions) {
    if (known.has(normalizedDish(item.dish)) || isTaken(item.dish) || hiddenSuggestions.has(normalizedDish(item.dish))) continue;
    const title = categoryForDish(item.dish);
    let group = base.find(c => c.title === title);
    if (!group) { group = { title, dishes: [] }; base.push(group); }
    if (!group.dishes.some(d => normalizedDish(d) === normalizedDish(item.dish))) group.dishes.push(item.dish);
  }
  return base;
}
function populateDishOptions() {
  const oldValue = select.value;
  select.innerHTML = '<option value="" selected disabled>Vælg en ret …</option>' +
    availableCategories().filter(c => c.dishes.length).map(category =>
      `<optgroup label="${escapeText(category.title)}">${category.dishes.map(d => `<option value="${escapeText(d)}">${escapeText(d)}</option>`).join('')}</optgroup>`
    ).join('') + '<option value="__custom__">＋ Jeg vil oprette en ny ret …</option>';
  if (oldValue && [...select.options].some(o => o.value === oldValue)) select.value = oldValue;
  else select.value = '';
}
function renderSuggestions() {
  const el = $('suggestions');
  el.innerHTML = '';
  let remaining = 0;
  for (const category of availableCategories()) {
    if (!category.dishes.length) continue;
    remaining += category.dishes.length;
    const section = document.createElement('section');
    section.className = 'suggestion-group';
    const heading = document.createElement('h3'); heading.textContent = category.title; section.appendChild(heading);
    const chips = document.createElement('div'); chips.className = 'suggestion-chips';
    for (const dish of category.dishes) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'suggestion-chip';
      button.textContent = dish + ' ＋';
      button.addEventListener('click', () => {
        select.value = dish; setCustomMode(false); $('toggle-custom').textContent = '＋ Opret en ny ret';
        $('signup-heading').scrollIntoView({behavior:'smooth',block:'start'}); nameInput.focus();
      });
      if (isAdmin) {
        const suggestion = extraSuggestions.find(item => normalizedDish(item.dish) === normalizedDish(dish));
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'delete-button';
        del.textContent = 'Slet';
        del.setAttribute('aria-label', 'Slet forslag: ' + dish);
        del.addEventListener('click', async () => {
          if (!confirm('Vil du fjerne forslaget “' + dish + '” fra listen?')) return;
          del.disabled = true;
          try {
            if (suggestion) {
              await deleteDoc(doc(db, 'suggestions', suggestion.id));
            } else {
              // Faste forslag findes i kildekoden og skjules derfor i Firestore.
              await setDoc(doc(db, 'hiddenSuggestions', encodeURIComponent(normalizedDish(dish))), {
                dish: dish, hiddenAt: serverTimestamp()
              });
            }
            // Vent på liveopdatering; denne vises hos alle besøgende.
          } catch (err) {
            console.error('Kunne ikke slette forslag:', err);
            alert('Forslaget kunne ikke slettes (' + (err.code || 'ukendt fejl') + ').\n\nHvis det er et af de oprindelige forslag, skal du publicere firestore.rules fra ZIP-filen i Cloud Firestore → Rules.\n\nDetaljer: ' + err.message);
          } finally { del.disabled = false; }
        });
        const itemWrap = document.createElement('span');
        itemWrap.className = 'suggestion-admin-item';
        itemWrap.append(button, del);
        chips.appendChild(itemWrap);
      } else {
        chips.appendChild(button);
      }
    }
    section.appendChild(chips); el.appendChild(section);
  }
  if (!remaining) {
    const p = document.createElement('p'); p.className = 'muted';
    p.textContent = 'Alle forslag er valgt! Du kan stadig oprette en ny ret.';
    el.appendChild(p);
  }
  populateDishOptions();
}
function setCustomMode(on) {
  customRow.hidden = !on;
  customInput.required = on;
  bringCustom.closest('.custom-choice').hidden = !on;
  if (on) bringCustom.checked = true;
  updateCustomChoice();
  if (on) { select.value = '__custom__'; customInput.focus(); }
  else { customInput.value = ''; if (select.value === '__custom__') select.value = ''; }
}
function updateCustomChoice() {
  const suggestionOnly = !customRow.hidden && !bringCustom.checked;
  nameInput.required = !suggestionOnly;
  nameInput.closest('.field').hidden = suggestionOnly;
  $('signup-heading').textContent = suggestionOnly ? 'Foreslå en ret' : 'Jeg tager med';
  submitButton.innerHTML = suggestionOnly ? '＋ Tilføj kun forslag' : '<span>＋</span> Tilføj mig på listen';
}
bringCustom.addEventListener('change', updateCustomChoice);
function updateDishMode() { setCustomMode(select.value === '__custom__'); }
select.addEventListener('change', updateDishMode);
$('toggle-custom').addEventListener('click', () => {
  const next = customRow.hidden;
  setCustomMode(next);
  $('toggle-custom').textContent = next ? '↩ Vælg en fast ret' : '＋ Opret en ny ret';
});
// Navne i fælles tilmeldinger grupperes uanset rækkefølge:
// "Alexander og Michala" og "Michala og Alexander" er samme gruppe.
function canonicalPersonName(value) {
  const parts = String(value ?? '').trim().split(/\s+og\s+/i)
    .map(part => part.trim().replace(/\s+/g, ' ')).filter(Boolean);
  if (parts.length > 1) {
    const unique = [...new Map(parts.map(part => [part.toLocaleLowerCase('da'), part])).values()];
    unique.sort((a, b) => a.localeCompare(b, 'da'));
    return unique.join(' og ');
  }
  return parts[0] || '';
}
function renderList() {
  loadingEl.hidden = true;
  $('total-count').textContent = contributions.length;
  emptyEl.hidden = contributions.length !== 0;
  listEl.innerHTML = '';
  renderSuggestions();
  const grouped = new Map();
  for (const item of contributions) {
    const name = canonicalPersonName(item.name);
    const key = name.toLocaleLowerCase('da');
    if (!grouped.has(key)) grouped.set(key, { name, items: [] });
    grouped.get(key).items.push(item);
  }
  const groups = [...grouped.values()].sort((a,b) => a.name.localeCompare(b.name, 'da'));
  for (const group of groups) {
    const card = document.createElement('article');
    card.className = 'person-card';
    const header = document.createElement('div'); header.className = 'person-header';
    const title = document.createElement('h3'); title.textContent = '🎁 ' + group.name;
    const count = document.createElement('span'); count.className = 'person-count';
    count.textContent = group.items.length + (group.items.length === 1 ? ' ret' : ' retter');
    header.append(title, count); card.appendChild(header);
    const itemsEl = document.createElement('div'); itemsEl.className = 'person-dishes';
    for (const item of group.items.sort((a,b) => a.dish.localeCompare(b.dish,'da'))) {
      const line = document.createElement('div'); line.className = 'person-dish';
      const label = document.createElement('span'); label.textContent = '🍽️ ' + item.dish;
      line.appendChild(label);
      if (isAdmin) {
        const del = document.createElement('button'); del.type = 'button'; del.className = 'delete-button';
        del.textContent = 'Slet'; del.setAttribute('aria-label', `Slet ${item.dish}, tilmeldt af ${item.name}`);
        del.addEventListener('click', async () => {
          if (!confirm(`Vil du slette tilmeldingen “${item.dish} — ${item.name}”?`)) return;
          try { await deleteDoc(doc(db, 'contributions', item.id)); }
          catch (err) { alert('Tilmeldingen kunne ikke slettes. Kontrollér arrangørlogin.'); console.error(err); }
        });
        line.appendChild(del);
      }
      itemsEl.appendChild(line);
    }
    card.appendChild(itemsEl); listEl.appendChild(card);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(formMessage, '');
  if (!firebaseReady) { setMessage(formMessage, 'Hjemmesiden mangler Firebase-opsætning. Følg vejledningen i README-filen.'); return; }
  const name = nameInput.value.trim();
  const suggestionOnly = !customRow.hidden && !bringCustom.checked;
  const dish = select.value === '__custom__' ? customInput.value.trim() : select.value;
  const isCustom = select.value === '__custom__';
  const category = isCustom ? categoryForDish(dish) : '';
  if (!suggestionOnly && !name) { setMessage(formMessage, 'Skriv dit navn, før du tilmelder dig.'); nameInput.focus(); return; }
  if (!dish || dish === '__custom__') { setMessage(formMessage, 'Vælg en ret eller skriv navnet på en ny ret.'); return; }
  if (isTaken(dish)) { setMessage(formMessage, 'Den ret er allerede valgt. Vælg en anden ret.'); renderSuggestions(); return; }
  if (name.length > 60 || dish.length > 80) { setMessage(formMessage, 'Navnet eller retten er for langt.'); return; }
  if (suggestionOnly) {
    if (categories.some(c => c.dishes.some(d => normalizedDish(d) === normalizedDish(dish))) ||
        extraSuggestions.some(s => normalizedDish(s.dish) === normalizedDish(dish))) {
      setMessage(formMessage, 'Retten findes allerede blandt forslagene.'); return;
    }
    submitButton.disabled = true;
    try {
      await addDoc(collection(db, 'suggestions'), { dish, category, createdAt: serverTimestamp() });
      setCustomMode(false);
      $('toggle-custom').textContent = '＋ Opret en ny ret';
      setMessage(formMessage, 'Forslaget er tilføjet! Ingen er tilmeldt retten.', true);
    } catch (err) {
      console.error('Forslagsfejl:', err);
      setMessage(formMessage, 'Kunne ikke gemme forslaget: ' + (err.code || err.message));
    } finally { submitButton.disabled = false; updateCustomChoice(); }
    return;
  }
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true; submit.textContent = 'Tilføjer …';
  try {
    await addDoc(collection(db, 'contributions'), { name, dish, ...(isCustom ? { category } : {}), createdAt: serverTimestamp() });
    nameInput.value = '';
    if (select.value === '__custom__') { select.value = ''; customInput.value = ''; setCustomMode(false); $('toggle-custom').textContent = '＋ Opret en ny ret'; }
    else select.value = '';
    setMessage(formMessage, `Tak ${name}! Du er skrevet på til ${dish}.`, true);
  } catch (err) {
    console.error(err); setMessage(formMessage, 'Kunne ikke gemme tilmeldingen. Prøv igen om lidt.');
  } finally { submit.disabled = false; updateCustomChoice(); }
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
    onSnapshot(collection(db, 'suggestions'), snapshot => {
      extraSuggestions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(d => typeof d.dish === 'string');
      renderSuggestions(); populateDishOptions();
    }, err => {
      console.error('Forslag kunne ikke hentes:', err);
      setMessage(formMessage, 'Forslag kan ikke hentes. Kontrollér Firestore-reglerne: ' + (err.code || err.message));
    });
    onSnapshot(collection(db, 'hiddenSuggestions'), snapshot => {
      hiddenSuggestions = new Set(snapshot.docs.map(d => normalizedDish(d.data().dish || '')));
      renderSuggestions();
      populateDishOptions();
    }, err => {
      console.error('Skjulte forslag kunne ikke hentes:', err);
      setMessage(formMessage, 'Skjulte forslag kunne ikke hentes: ' + (err.code || err.message));
    });
    onAuthStateChanged(auth, user => {
      isAdmin = !!user && (user.email || '').toLowerCase() === 'alexander.madsen@me.com';
      $('admin-status').hidden = !isAdmin;
      $('admin-toggle').hidden = isAdmin;
      renderList();
      renderSuggestions();
    });
  } catch (err) {
    console.error(err); loadingEl.hidden = true;
    setMessage(formMessage, 'Firebase kunne ikke startes. Tjek opsætningen i app.js.');
  }
}
populateDishOptions();
setCustomMode(false);
initFirebase();
