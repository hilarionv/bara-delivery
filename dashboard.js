import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, BUCKET } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);
const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const fcfa = (n) => (n || 0).toLocaleString('fr-FR') + ' FCFA';

const SL = { brief: 'Brief', in_progress: 'En cours', in_review: 'En validation', delivered: 'Livré' };
const KIND_LABEL = { logo: 'Logo', pdf: 'Identité en PDF', situation: 'Logo en situation', visual: 'Visuel' };
const LIST = { identity: ['logo', 'pdf', 'situation', 'visual'], visuals: ['visual'] };

let projects = [];   // liste des projets + leurs assets/appointments/feedback chargés à l'ouverture
let F = 'all', O = null, E = '';

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.className = 'on';
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), 2200);
}

// ---------------------------------------------------------------- auth
$('#login-send').onclick = async () => {
  const email = $('#login-email').value.trim();
  if (!email) return toast("Indique ton e-mail");
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
  const m = $('#login-msg');
  m.hidden = false;
  m.textContent = error ? "Erreur : " + error.message : "Lien envoyé, regarde ta boîte mail.";
};
$('#logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };

sb.auth.onAuthStateChange((_evt, session) => boot(session));
boot((await sb.auth.getSession()).data.session);

async function boot(session) {
  const user = session?.user;
  if (!user || user.email !== ADMIN_EMAIL) {
    $('#login-screen').hidden = false; $('#app').hidden = true;
    return;
  }
  $('#login-screen').hidden = true; $('#app').hidden = false;
  await loadAll();
}

// ---------------------------------------------------------------- chargement
async function loadAll() {
  const { data: p, error } = await sb.from('bara_projects').select('*').order('created_at', { ascending: false });
  if (error) { toast('Erreur de chargement : ' + error.message); return; }
  projects = p || [];
  const ids = projects.map((x) => x.id);
  if (ids.length) {
    const [{ data: assets }, { data: appts }, { data: fb }] = await Promise.all([
      sb.from('bara_assets').select('*').in('project_id', ids).order('position'),
      sb.from('bara_appointments').select('*').in('project_id', ids).order('starts_at'),
      sb.from('bara_feedback').select('*').in('project_id', ids).order('created_at'),
    ]);
    for (const x of projects) {
      x.assets = (assets || []).filter((a) => a.project_id === x.id);
      x.appointments = (appts || []).filter((a) => a.project_id === x.id);
      x.feedback = (fb || []).filter((f) => f.project_id === x.id);
    }
  }
  render();
}

function assetOf(x, kind) { return x.assets.find((a) => a.kind === kind); }
function nextAppt(x) {
  const now = Date.now();
  return x.appointments.filter((a) => new Date(a.starts_at).getTime() >= now).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0];
}
function itemsFor(x) { return LIST[x.type] || []; }
function itemOk(x, kind) {
  if (kind === 'logo' || kind === 'pdf') return !!assetOf(x, kind);
  if (kind === 'situation') return x.assets.some((a) => a.kind === 'situation');
  if (kind === 'visual') return x.assets.some((a) => a.kind === 'visual');
  return false;
}
function progress(x) {
  const list = itemsFor(x);
  const uniqueKinds = [...new Set(list)];
  const done = uniqueKinds.filter((k) => itemOk(x, k)).length;
  return [done, uniqueKinds.length];
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'à définir'; }
function fmtDateTime(d) { return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }

// ---------------------------------------------------------------- rendu
function render() {
  const active = projects.filter((x) => x.status !== 'delivered');
  $('#stats').innerHTML =
    `<div><b>${active.length}</b><span>en cours</span></div>` +
    `<div><b>${projects.filter((x) => x.status === 'in_review').length}</b><span>à valider</span></div>` +
    `<div><b>${active.reduce((a, x) => a + (x.price || 0), 0).toLocaleString('fr-FR')}</b><span>FCFA à venir</span></div>`;

  const todo = [];
  for (const x of projects) {
    const unresolved = x.feedback.filter((f) => !f.resolved).length;
    if (unresolved) todo.push([x.id, `${x.client_name} : ${unresolved} retour${unresolved > 1 ? 's' : ''} à traiter`, 'Voir']);
    else if (x.status === 'brief' || x.status === 'in_progress') {
      const [done, total] = progress(x);
      if (done < total) todo.push([x.id, `${x.client_name} : ${total - done} élément${total - done > 1 ? 's' : ''} à ajouter`, 'Remplir']);
    }
  }
  $('#todo').innerHTML = todo.slice(0, 3).map(([id, label, cta]) =>
    `<button data-open="${id}"><span>${esc(label)}</span><i>${cta} →</i></button>`).join('');

  $('#chips').innerHTML = ['all', 'brief', 'in_progress', 'in_review', 'delivered'].map((k) =>
    `<button data-f="${k}" aria-pressed="${F === k}">${k === 'all' ? 'Tous' : SL[k]}</button>`).join('');

  $('#list').innerHTML = projects.filter((x) => F === 'all' || x.status === F).map((x) => {
    const open = O === x.id;
    const [done, total] = progress(x);
    const color = x.colors?.[0] || '#0A1F6B';
    let h = `<div class="it"><button class="hd" data-open="${x.id}" aria-expanded="${open}">` +
      `<span><span class="ch" style="background:${color}">${esc(x.client_name.charAt(0))}</span>` +
      `<span><b>${esc(x.client_name)}</b><small>${x.type === 'identity' ? 'Identité + visuels' : 'Visuels seuls'} · deadline ${esc(fmtDate(x.deadline))}</small></span></span>` +
      `<span class="tg"><span class="tag">${SL[x.status]}</span><small>${total ? `${done}/${total} prêts` : ''}</small></span></button>` +
      `<div class="pg"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>`;

    if (open) {
      h += `<div class="dt"><h3>Contenu de la page client</h3>`;
      for (const kind of [...new Set(itemsFor(x))]) {
        const key = `${x.id}:${kind}`;
        const ready = itemOk(x, kind);
        const label = kind === 'visual'
          ? `${x.assets.filter((a) => a.kind === 'visual').length} fichier(s)`
          : (assetOf(x, kind)?.name || 'aucun fichier');
        h += `<div class="ck"><span class="dot${ready ? ' ok' : ''}"></span><span><b>${KIND_LABEL[kind]}</b><small>${esc(label)}</small></span><button data-ed="${key}">${ready ? 'Ajouter d\u2019autres' : 'Ajouter'}</button></div>`;
        if (E === key) h += editorFor(kind, x.id);
      }
      h += `<h3>Couleurs et typographies</h3>` +
        `<div class="ck"><span></span><span><b>Couleurs</b><small>${esc((x.colors || []).join(', ') || 'aucune')}</small></span><button data-ed="${x.id}:colors">Modifier</button></div>` +
        (E === `${x.id}:colors` ? colorEditor(x) : '') +
        `<div class="ck"><span></span><span><b>Typographies</b><small>${esc([x.font_title, x.font_body].filter(Boolean).join(' / ') || 'aucune')}</small></span><button data-ed="${x.id}:fonts">Modifier</button></div>` +
        (E === `${x.id}:fonts` ? fontEditor(x) : '');

      const link = `${location.origin}${location.pathname.replace('dashboard.html', '')}client.html?t=${x.share_token}`;
      h += `<div class="row"><a class="btn" href="${link}" target="_blank" rel="noopener">Voir comme le client</a><button data-cp="${x.id}">Copier le lien</button></div>`;

      h += `<h3>Retours du client</h3>` + (x.feedback.length
        ? x.feedback.map((f, i) => `<div class="fb${f.resolved ? ' dn' : ''}"><span class="pn${f.x != null ? '' : ' z'}">${f.x != null ? i + 1 : '·'}</span><span>${esc(f.body)}</span><button data-fd="${f.id}">${f.resolved ? 'Rouvrir' : 'Traité'}</button></div>`).join('')
        : `<p class="mute">Aucun retour pour l\u2019instant.</p>`);

      h += `<h3>Rendez-vous</h3>` + (x.appointments.length
        ? x.appointments.map((a) => `<p>${esc(fmtDateTime(a.starts_at))}${a.link ? ' — ' + esc(a.link) : ''}</p>`).join('')
        : `<p class="mute">Aucun rendez-vous.</p>`) +
        `<div class="ed" id="rdv-add-${x.id}" hidden><input type="datetime-local" id="rdv-dt-${x.id}"><input placeholder="Lien visio ou lieu" id="rdv-lk-${x.id}"><div class="row"><button class="pri" data-rdv-ok="${x.id}">Ajouter</button></div></div>` +
        `<div class="row"><button data-rdv="${x.id}">Ajouter un rendez-vous</button></div>`;

      h += `<h3>Infos du projet</h3><p>${esc(x.description || '-')}</p><p>Prix : ${fcfa(x.price)} <span class="mute">(visible par toi seulement)</span></p>`;
      h += `<h3>Statut</h3><select data-st="${x.id}">${Object.keys(SL).map((k) => `<option value="${k}"${k === x.status ? ' selected' : ''}>${SL[k]}</option>`).join('')}</select>`;
      h += `<h3>Lien privé du client</h3><code>${esc(link)}</code>`;
      h += `</div>`;
    }
    return h + `</div>`;
  }).join('');

  const allAppts = projects.flatMap((x) => x.appointments.map((a) => ({ ...a, client: x.client_name })))
    .filter((a) => new Date(a.starts_at) >= new Date()).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  $('#rdv').innerHTML = allAppts.length
    ? allAppts.map((a) => `<div class="rv"><b>${esc(a.client)}</b><span>${esc(fmtDateTime(a.starts_at))}</span></div>`).join('')
    : `<p class="mute">Aucun rendez-vous prévu.</p>`;
}

function editorFor(kind, pid) {
  return `<div class="ed"><input type="file" data-file="${pid}:${kind}" accept="${kind === 'pdf' ? 'application/pdf' : 'image/*'}"${kind === 'visual' || kind === 'situation' ? ' multiple' : ''}></div>`;
}
function colorEditor(x) {
  return `<div class="ed"><span class="mute">Colle les codes, séparés par des virgules</span>` +
    `<input data-col="${x.id}" value="${esc((x.colors || []).join(', '))}" placeholder="#3B2A20, #F1E7D8, #E0A526">` +
    `<div class="swr">${(x.colors || []).map((h) => `<span style="background:${h}"></span>`).join('')}</div>` +
    `<div class="row"><button class="pri" data-savecol="${x.id}">Enregistrer</button></div></div>`;
}
function fontEditor(x) {
  return `<div class="ed"><input data-ft="${x.id}" value="${esc(x.font_title || '')}" placeholder="Police des titres">` +
    `<input data-fb="${x.id}" value="${esc(x.font_body || '')}" placeholder="Police des textes">` +
    `<div class="row"><button class="pri" data-savefont="${x.id}">Enregistrer</button></div></div>`;
}

// ---------------------------------------------------------------- actions
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;

  if (d.open) { O = O === d.open ? null : d.open; E = ''; render(); return; }
  if (d.f) { F = d.f; O = null; E = ''; render(); return; }
  if (d.ed) { E = E === d.ed ? '' : d.ed; render(); return; }

  if (d.cp) {
    const x = projects.find((p) => p.id === d.cp);
    const link = `${location.origin}${location.pathname.replace('dashboard.html', '')}client.html?t=${x.share_token}`;
    try { await navigator.clipboard.writeText(link); } catch {}
    toast('Lien copié'); return;
  }
  if (d.savecol) {
    const val = $(`[data-col="${d.savecol}"]`).value;
    const colors = (val.match(/#[0-9a-fA-F]{6}\b/g) || []);
    const { error } = await sb.from('bara_projects').update({ colors }).eq('id', d.savecol);
    if (error) return toast('Erreur : ' + error.message);
    Object.assign(projects.find((p) => p.id === d.savecol), { colors });
    E = ''; render(); toast('Couleurs enregistrées'); return;
  }
  if (d.savefont) {
    const font_title = $(`[data-ft="${d.savefont}"]`).value.trim();
    const font_body = $(`[data-fb="${d.savefont}"]`).value.trim();
    const { error } = await sb.from('bara_projects').update({ font_title, font_body }).eq('id', d.savefont);
    if (error) return toast('Erreur : ' + error.message);
    Object.assign(projects.find((p) => p.id === d.savefont), { font_title, font_body });
    E = ''; render(); toast('Typographies enregistrées'); return;
  }
  if (d.fd) {
    const fb = projects.flatMap((p) => p.feedback).find((f) => f.id === d.fd);
    const { error } = await sb.from('bara_feedback').update({ resolved: !fb.resolved }).eq('id', d.fd);
    if (error) return toast('Erreur : ' + error.message);
    fb.resolved = !fb.resolved; render(); return;
  }
  if (d.rdv) { $(`#rdv-add-${d.rdv}`).hidden = false; return; }
  if (d.rdvOk) {
    const dt = $(`#rdv-dt-${d.rdvOk}`).value, lk = $(`#rdv-lk-${d.rdvOk}`).value.trim();
    if (!dt) return toast('Choisis une date');
    const { data, error } = await sb.from('bara_appointments').insert({ project_id: d.rdvOk, starts_at: new Date(dt).toISOString(), link: lk }).select().single();
    if (error) return toast('Erreur : ' + error.message);
    projects.find((p) => p.id === d.rdvOk).appointments.push(data);
    render(); toast('Rendez-vous ajouté'); return;
  }

  if (b.id === 'nb') { $('#nf').hidden = !$('#nf').hidden; return; }
  if (b.id === 'f-no') { $('#nf').hidden = true; return; }
  if (b.id === 'f-ok') {
    const client_name = $('#f-n').value.trim();
    if (!client_name) return toast('Indique le nom du client');
    const payload = {
      client_name, type: $('#f-t').value, description: $('#f-d').value.trim(),
      deadline: $('#f-dl').value || null, price: +$('#f-p').value || 0,
    };
    const { data, error } = await sb.from('bara_projects').insert(payload).select().single();
    if (error) return toast('Erreur : ' + error.message);
    data.assets = []; data.appointments = []; data.feedback = [];
    projects.unshift(data);
    ['#f-n', '#f-d', '#f-dl', '#f-p'].forEach((s) => ($(s).value = ''));
    $('#nf').hidden = true; F = 'all'; O = data.id; E = '';
    render(); toast('Projet créé, lien prêt');
  }
});

document.addEventListener('change', async (e) => {
  const d = e.target.dataset;
  if (d.st) {
    const { error } = await sb.from('bara_projects').update({ status: e.target.value }).eq('id', d.st);
    if (error) return toast('Erreur : ' + error.message);
    projects.find((p) => p.id === d.st).status = e.target.value; render(); return;
  }
  if (d.file) {
    const [pid, kind] = d.file.split(':');
    const files = [...e.target.files];
    for (const file of files) {
      const path = `${pid}/${kind}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) { toast('Erreur upload : ' + upErr.message); continue; }
      const { data, error } = await sb.from('bara_assets').insert({ project_id: pid, kind, name: file.name, path }).select().single();
      if (error) { toast('Erreur : ' + error.message); continue; }
      projects.find((p) => p.id === pid).assets.push(data);
    }
    E = ''; render(); toast('Fichier(s) ajouté(s)');
  }
});
