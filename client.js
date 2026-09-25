import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);
const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };
const fileUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

const STEP_LABEL = { brief: 'Brief', in_progress: 'Création', in_review: 'Validation', delivered: 'Livré' };
const STEP_INDEX = { brief: 1, in_progress: 2, in_review: 3, delivered: 4 };

const token = new URLSearchParams(location.search).get('t');
let bg = 'light', commentMode = false, pins = [];

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.className = 'on';
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), 2200);
}

if (!token) {
  $('#app').innerHTML = '<p style="padding-top:24px">Lien invalide.</p>';
} else {
  load();
}

async function load() {
  const { data, error } = await sb.rpc('bara_get_client_project', { t: token });
  if (error || !data) {
    $('#app').innerHTML = '<p style="padding-top:24px">Ce lien n\u2019est plus valide. Contactez BARA WRLD.</p>';
    return;
  }
  render(data);
}

function render(p) {
  const logo = p.assets.find((a) => a.kind === 'logo');
  const pdf = p.assets.find((a) => a.kind === 'pdf');
  const situations = p.assets.filter((a) => a.kind === 'situation');
  const visuals = p.assets.filter((a) => a.kind === 'visual');
  pins = p.feedback || [];
  const idx = STEP_INDEX[p.status] || 1;
  const validated = !!p.validated_at;

  let h = '';

  if (p.type === 'identity' && logo) {
    h += `<div class="cover"><div class="ct"><b>BARA WRLD</b><span>Lien privé</span></div>` +
      `<img src="${fileUrl(logo.path)}" alt="Logo ${esc(p.client_name)}">` +
      `<div class="cb">Identité visuelle · Faites défiler ↓</div></div>`;
  }

  h += `<div class="hero"><div class="top"><b>BARA WRLD</b><span>Lien privé</span></div>`;
  h += `<h1>${esc(p.client_name)}${p.type === 'identity' ? ', identité visuelle' : ''}</h1>`;
  h += `<p class="meta">${p.deadline ? 'Livraison prévue le ' + esc(new Date(p.deadline).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })) : ''}</p>`;
  h += `<ol class="steps">${[1, 2, 3, 4].map((i) => `<li class="${i <= idx ? 'on' : ''}"></li>`).join('')}</ol>`;
  h += `<div class="stlabel">Brief, création, <b>${idx === 3 ? 'validation' : STEP_LABEL[p.status] === 'Validation' ? '' : ''}</b>${STEP_LABEL[p.status]}</div></div>`;

  if (p.type === 'identity') {
    if (logo) {
      h += `<section><h2>Votre logo</h2><div class="stage" id="stage" data-bg="light"><img src="${fileUrl(logo.path)}" alt="Logo"><div id="pins"></div></div>` +
        `<div class="seg" id="seg"><button aria-pressed="true" data-bg="light">Clair</button><button aria-pressed="false" data-bg="dark">Sombre</button><button aria-pressed="false" data-bg="color">Couleur</button></div>` +
        `<button id="cmode" aria-pressed="false">Commenter le logo</button><div id="cl"></div></section>`;
    }
    if (p.colors?.length) {
      h += `<section><h2>Couleurs</h2><div class="sw">${p.colors.map((c) => `<button data-hex="${c}" style="background:${c}">${esc(c)}</button>`).join('')}</div>` +
        `<p class="meta" style="color:var(--mute)">Touchez une couleur pour copier son code.</p></section>`;
    }
    if (p.font_title || p.font_body) {
      h += `<section><h2>Typographies</h2><div class="type">` +
        `<div style="font:700 28px/1.1 Georgia,serif">${esc(p.font_title || '—')}</div>` +
        `<div style="margin-top:8px;color:var(--mute)">Titres : ${esc(p.font_title || '—')} · Textes : ${esc(p.font_body || '—')}</div></div></section>`;
    }
    if (situations.length) {
      h += `<section><h2>Le logo en situation</h2><div class="gal">${situations.map((s) => `<figure class="fl" style="margin:0"><img src="${fileUrl(s.path)}" alt="${esc(s.name)}"></figure>`).join('')}</div></section>`;
    }
  }

  if (visuals.length) {
    h += `<section><h2>Vos visuels</h2><div class="gal">${visuals.map((v) => `<div class="fl"><img src="${fileUrl(v.path)}" alt="${esc(v.name)}"><a href="${fileUrl(v.path)}" download>Télécharger</a></div>`).join('')}</div></section>`;
  }

  const files = [];
  if (pdf) files.push(`<a class="primary" href="${fileUrl(pdf.path)}" download><span>Identité visuelle complète</span><small style="color:inherit">PDF</small></a>`);
  if (logo) files.push(`<a href="${fileUrl(logo.path)}" download><span>Logo</span><small>Fichier source</small></a>`);
  if (files.length) h += `<section><h2>Vos fichiers</h2><div class="dl">${files.join('')}</div></section>`;

  if (p.appointment) {
    h += `<section><h2>Rendez-vous</h2><div class="card"><p><b>Point de suivi</b><br>${esc(new Date(p.appointment.starts_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</p>` +
      (p.appointment.link ? `<div class="row"><a class="primary" href="${esc(p.appointment.link)}" target="_blank" rel="noopener">Rejoindre / voir le lieu</a></div>` : '') + `</div></section>`;
  }

  h += `<section><h2>Votre retour</h2><div class="card" id="fb">`;
  if (validated) {
    h += `<div class="done">Identité validée. Merci !</div>`;
  } else {
    h += `<p>Cela vous convient ? Validez, ou dites-nous ce qu\u2019il faut ajuster.</p>` +
      `<div class="row"><button class="primary" id="ok">Valider</button><button id="rt">Demander une retouche</button></div>` +
      `<div id="rtbox" hidden><textarea id="txt" placeholder="Votre retour"></textarea><div class="row"><button class="primary" id="send">Envoyer mes retours</button></div></div>` +
      `<div class="done" id="res" hidden></div>`;
  }
  h += `</div></section>`;

  $('#app').innerHTML = h;
  wire(p);
}

function wire(p) {
  const stage = $('#stage');
  document.querySelectorAll('#seg button').forEach((b) => {
    b.onclick = () => { bg = b.dataset.bg; stage.dataset.bg = bg; document.querySelectorAll('#seg button').forEach((x) => x.setAttribute('aria-pressed', x === b)); };
  });
  document.querySelectorAll('.sw button').forEach((b) => {
    b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.hex); } catch {} toast(b.dataset.hex + ' copié'); };
  });

  if (stage) {
    renderPins();
    const cmode = $('#cmode');
    cmode.onclick = () => {
      commentMode = !commentMode;
      cmode.setAttribute('aria-pressed', commentMode);
      stage.classList.toggle('cm-on', commentMode);
      if (commentMode) toast('Touchez le logo à l\u2019endroit à commenter');
    };
    stage.onclick = (e) => {
      if (!commentMode) return;
      const r = stage.getBoundingClientRect();
      const x = Math.round(((e.clientX - r.left) / r.width) * 100);
      const y = Math.round(((e.clientY - r.top) / r.height) * 100);
      pins.push({ x, y, body: '', _new: true });
      renderPins();
      const areas = document.querySelectorAll('#cl textarea');
      areas[areas.length - 1]?.focus();
    };
  }

  const ok = $('#ok');
  if (ok) {
    ok.onclick = async () => {
      const { error } = await sb.rpc('bara_validate_project', { t: token });
      if (error) return toast('Erreur : ' + error.message);
      $('#rtbox')?.setAttribute('hidden', '');
      ok.closest('#fb').innerHTML = '<div class="done">Identité validée. Merci !</div>';
    };
    $('#rt').onclick = () => { $('#rtbox').hidden = false; $('#txt').focus(); };
    $('#send').onclick = async () => {
      const v = $('#txt').value.trim();
      if (!v) return toast('Écrivez votre retour avant d\u2019envoyer');
      const { error } = await sb.rpc('bara_add_feedback', { t: token, txt: v, px: null, py: null });
      if (error) return toast('Erreur : ' + error.message);
      $('#rtbox').hidden = true;
      $('#res').hidden = false;
      $('#res').textContent = 'Retour envoyé. Nous revenons vers vous très vite.';
    };
  }
}

function renderPins() {
  $('#pins').innerHTML = pins.map((c, i) => `<span class="pin" style="left:${c.x}%;top:${c.y}%">${i + 1}</span>`).join('');
  $('#cl').innerHTML = pins.map((c, i) => c._new !== false
    ? `<div class="ci"><b>${i + 1}</b><textarea data-c="${i}" rows="2" placeholder="Votre remarque sur ce point"></textarea></div>`
    : '').join('') + (pins.some((c) => c._new) ? `<button class="primary" id="csend" style="width:100%;margin-top:8px">Envoyer mes commentaires</button>` : '');

  document.querySelectorAll('#cl textarea').forEach((t) => {
    t.oninput = () => { pins[+t.dataset.c].body = t.value; };
  });
  const csend = $('#csend');
  if (csend) {
    csend.onclick = async () => {
      const toSend = pins.filter((c) => c._new && c.body.trim());
      if (!toSend.length) return toast('Écrivez au moins un commentaire');
      for (const c of toSend) {
        const { error } = await sb.rpc('bara_add_feedback', { t: token, txt: c.body.trim(), px: c.x, py: c.y });
        if (error) { toast('Erreur : ' + error.message); return; }
        c._new = false;
      }
      toast('Commentaires envoyés');
      renderPins();
    };
  }
}
