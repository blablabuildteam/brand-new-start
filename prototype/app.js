const { REGIE } = window;

const state = {
  mode: "radar",
  activeStep: 0,
  activeRadar: 0,
  activeOutreach: 0,
  activeProces: 0,
  activeIntel: 0,
  feedExpanded: false,
  radarFilter: "all",
  nextChoice: {},
  outreachStatuses: {},
  approvals: Object.fromEntries(REGIE.steps.map((s) => [s.id, "pending"])),
  voorstelBody: REGIE.voorstel.body,
};

const FEED_PREVIEW = 6;

const $ = (id) => document.getElementById(id);

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-selected", String(on));
  });
  ["radar", "intel", "delivery", "demand", "proces", "pulse"].forEach((key) => {
    const el = $(`view-${key}`);
    if (!el) return;
    const show = key === mode;
    el.classList.toggle("is-hidden", !show);
    el.hidden = !show;
  });
  if (mode === "radar") renderRadar();
  if (mode === "intel") renderIntel();
  if (mode === "delivery") {
    renderOpdracht();
    setStep(state.activeStep);
  }
  if (mode === "demand") renderDemand();
  if (mode === "proces") renderProces();
  if (mode === "pulse") mountPulseTab();
}

window.RegieApp = { setMode, setStep: (i) => setStep(i) };

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getChoice(r) {
  return (
    state.nextChoice[r.id] || {
      nextId: r.suggestedNext,
      who: r.suggestedWho,
    }
  );
}

/* —— Radar —— */
function filteredRadar() {
  const rows = REGIE.demand.radar;
  switch (state.radarFilter) {
    case "hot":
      return rows.filter((r) => r.status === "hot");
    case "talk":
      return rows.filter((r) => r.lastTalk);
    case "contract":
      return rows.filter((r) => r.contractReady);
    default:
      return rows;
  }
}

const TREND = { up: "▲", flat: "▶", down: "▼" };

function intelById(id) {
  return REGIE.intel?.sources?.find((s) => s.id === id) || null;
}

function sourceLabel(id) {
  return intelById(id)?.title || id;
}

function sourceChips(ids, opts = {}) {
  const list = (ids || []).filter(Boolean);
  if (!list.length) return `<span class="muted">—</span>`;
  return list
    .map((id) => {
      const s = intelById(id);
      const title = s ? `${s.title} — ${s.fetchFrom}` : id;
      return `<span class="src-chip" data-src="${escapeHtml(id)}" title="${escapeHtml(title)}">${escapeHtml(
        s?.title || id
      )}</span>`;
    })
    .join("");
}

function renderAlerts() {
  const strip = $("alert-strip");
  if (!strip) return;
  strip.innerHTML = REGIE.demand.alerts
    .map(
      (a) => `
    <span class="alert-chip alert-${a.type}">
      <em>${escapeHtml(a.when)}</em>
      ${escapeHtml(a.text)}
    </span>`
    )
    .join("");
}

function kansTooltipHtml(r) {
  return `
    <strong>Waarom kans ${r.signalStrength}?</strong>
    <ul>
      ${(r.kansFactors || [])
        .map((f) => {
          const src = f.source ? intelById(f.source) : null;
          return `<li><span class="pts">+${f.points}</span> <span>${escapeHtml(f.label)}${
            src ? ` <em class="tip-src">${escapeHtml(src.title)}</em>` : ""
          }</span></li>`;
        })
        .join("")}
    </ul>
    ${
      r.sources?.length
        ? `<p class="tip-foot">Bronnen: ${r.sources.map((id) => escapeHtml(sourceLabel(id))).join(" · ")}</p>`
        : ""
    }`;
}

function showFloatingTip(anchor, html) {
  const tip = $("tooltip-root");
  if (!tip || !anchor) return;
  tip.innerHTML = html;
  tip.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const tipW = 280;
  let left = rect.left + rect.width / 2 - tipW / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
  tip.style.width = tipW + "px";
  tip.style.left = left + "px";
  // Measure after show
  const h = tip.offsetHeight || 120;
  let top = rect.top - h - 10;
  if (top < 8) top = rect.bottom + 10;
  tip.style.top = top + "px";
}

function hideFloatingTip() {
  const tip = $("tooltip-root");
  if (!tip) return;
  tip.hidden = true;
  tip.innerHTML = "";
}

function renderRadar() {
  const all = REGIE.demand.radar;
  const rows = filteredRadar();
  const hot = all.filter((r) => r.status === "hot").length;
  const ready = all.filter((r) => r.contractReady).length;
  const withTalk = all.filter((r) => r.lastTalk).length;
  $("radar-stats").textContent = `${hot} hot · ${ready} ZZP/interim · ${withTalk} met gesprek · ${all.length} bedrijven`;

  renderAlerts();

  $("radar-body").innerHTML = rows
    .map((r) => {
      const idx = all.indexOf(r);
      const on = idx === state.activeRadar;
      return `
      <tr class="radar-row status-${r.status}${on ? " is-on" : ""}" data-radar="${idx}" tabindex="0">
        <td>
          <strong>${escapeHtml(r.company)}</strong>
          ${r.contractReady ? `<span class="tag-ready">ZZP/interim</span>` : ""}
        </td>
        <td>${escapeHtml(r.hm)}</td>
        <td>
          <strong>${escapeHtml(r.role)}</strong>
          <span class="muted">${escapeHtml(r.roleType)}</span>
        </td>
        <td class="src-cell">${sourceChips(r.sources)}</td>
        <td class="${r.lastTalk ? "" : "is-muted"}">${escapeHtml(r.lastTalkLabel)}</td>
        <td class="kans-cell">
          <button type="button" class="kans-wrap" data-kans="${idx}" aria-label="Uitleg kans ${r.signalStrength}">
            <span class="signal-bar" style="--v:${r.signalStrength}%"><em>${r.signalStrength}</em></span>
            <span class="trend trend-${r.trend}">${TREND[r.trend] || ""}</span>
          </button>
        </td>
      </tr>`;
    })
    .join("");

  renderRadarDetail();
}

function renderRadarDetail() {
  const r = REGIE.demand.radar[state.activeRadar];
  if (!r) return;
  const choice = getChoice(r);

  $("radar-detail").innerHTML = `
    <p class="detail-kicker">${r.status} · kans ${r.signalStrength}</p>
    <h3>${escapeHtml(r.company)}</h3>
    <p class="muted detail-hm">Hiring manager: <strong>${escapeHtml(r.hm)}</strong><br />${escapeHtml(r.role)}</p>

    ${
      r.contractReady
        ? `<p class="badge-explain"><span class="tag-ready">ZZP/interim</span> Bevestigd open voor contractor</p>`
        : `<p class="badge-explain muted">Nog geen harde ZZP-bevestiging — interim-pitch mogelijk naast vast</p>`
    }

    <h4 class="detail-sub">Signalen uit bronnen</h4>
    <ul class="src-detail-list">
      ${(r.sources || [])
        .map((id) => {
          const s = intelById(id);
          if (!s) return `<li>${escapeHtml(id)}</li>`;
          return `<li>
            <strong>${escapeHtml(s.title)}</strong>
            <span class="muted">ophalen uit: ${escapeHtml(s.fetchFrom)}</span>
            <span>${escapeHtml(s.why)}</span>
          </li>`;
        })
        .join("")}
    </ul>

    <h4 class="detail-sub">Waarom deze kans?</h4>
    <ul class="factor-list">
      ${(r.kansFactors || [])
        .map((f) => {
          const src = f.source ? intelById(f.source) : null;
          return `<li>
            <span class="pts">+${f.points}</span>
            <span>${escapeHtml(f.label)}${
              src ? ` <span class="src-chip src-inline">${escapeHtml(src.title)}</span>` : ""
            }</span>
          </li>`;
        })
        .join("")}
    </ul>

    <h4 class="detail-sub">Gesprekken</h4>
    <ul class="talk-list">
      ${
        r.talks.length
          ? r.talks
              .map(
                (t) =>
                  `<li><strong>${escapeHtml(t.when)}</strong> ${escapeHtml(t.what)}</li>`
              )
              .join("")
          : `<li class="muted">Nog geen gesprek bekend</li>`
      }
    </ul>

    <h4 class="detail-sub">Volgende stap</h4>
    <p class="muted next-intro">Kies wat er moet gebeuren, en wie het doet.</p>

    <fieldset class="choice-block">
      <legend>Kwalificatie</legend>
      ${r.nextOptions
        .map(
          (opt) => `
        <label class="choice-row${choice.nextId === opt.id ? " is-on" : ""}">
          <input type="radio" name="next-qual" value="${opt.id}" ${
            choice.nextId === opt.id ? "checked" : ""
          } />
          <span>
            <strong>${escapeHtml(opt.label)}</strong>
            <span class="muted">${escapeHtml(opt.desc)}</span>
          </span>
        </label>`
        )
        .join("")}
    </fieldset>

    <fieldset class="choice-block">
      <legend>Wie doet dit?</legend>
      <label class="choice-row${choice.who === "agent" ? " is-on" : ""}">
        <input type="radio" name="next-who" value="agent" ${
          choice.who === "agent" ? "checked" : ""
        } />
        <span>
          <strong>Agent doet dit</strong>
          <span class="muted">Concept / outreach / shortlist klaarzetten — jij keurt goed</span>
        </span>
      </label>
      <label class="choice-row${choice.who === "self" ? " is-on" : ""}">
        <input type="radio" name="next-who" value="self" ${
          choice.who === "self" ? "checked" : ""
        } />
        <span>
          <strong>Ik doe dit zelf</strong>
          <span class="muted">Jij belt of schrijft — tool blijft open als checklist</span>
        </span>
      </label>
    </fieldset>

    <div class="approve-actions" style="margin-top:0.85rem">
      <button type="button" class="btn btn-primary btn-sm" id="btn-start-next">Start deze stap</button>
      ${
        r.id === "r1"
          ? `<button type="button" class="btn btn-ghost btn-sm" id="btn-to-delivery">Naar opdracht</button>`
          : ""
      }
    </div>
    <p class="hint" id="next-confirm"></p>
  `;

  $("radar-detail").querySelectorAll('input[name="next-qual"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.nextChoice[r.id] = { ...getChoice(r), nextId: input.value };
      renderRadarDetail();
    });
  });
  $("radar-detail").querySelectorAll('input[name="next-who"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.nextChoice[r.id] = { ...getChoice(r), who: input.value };
      renderRadarDetail();
    });
  });

  $("btn-start-next")?.addEventListener("click", () => {
    const c = getChoice(r);
    const opt = r.nextOptions.find((o) => o.id === c.nextId);
    const whoLabel = c.who === "agent" ? "Agent" : "Jij zelf";
    const confirm = $("next-confirm");
    if (confirm) {
      confirm.textContent = `Gepland: ${opt?.label || c.nextId} · uitgevoerd door: ${whoLabel}`;
    }
    if (c.nextId === "shortlist" || c.nextId === "interim-pitch") {
      const idx = REGIE.demand.outreachQueue.findIndex((o) => o.company === r.company);
      if (idx >= 0 && c.who === "agent") {
        state.activeOutreach = idx;
        setTimeout(() => setMode("demand"), 400);
      }
    }
  });

  $("btn-to-delivery")?.addEventListener("click", () => {
    setMode("delivery");
    setStep(0);
  });
}

/* —— Proces schema —— */
function humanLabel(level) {
  if (level === "zwaar") return "BNS beslist";
  if (level === "middel") return "BNS keurt goed";
  return "BNS licht betrokken";
}

function humanShort(level) {
  if (level === "zwaar") return "Beslist";
  if (level === "middel") return "Keurt goed";
  return "Licht";
}

function whoLine(s) {
  if (!s.agents.length) return "Alleen Brand New Start";
  if (s.humanLevel === "licht") return "Agents doen het werk · BNS scant";
  if (s.humanLevel === "middel") return "Agents leveren · BNS keurt goed";
  return "Agents ondersteunen · BNS regisseert";
}

function renderProces() {
  const steps = REGIE.proces;

  $("schema").innerHTML = `
    <ol class="flow-list">
      ${steps
        .map((s, i) => {
          const on = i === state.activeProces;
          const branchClass = s.branch ? " is-branch" : "";
          const endClass = s.end ? " is-end" : "";
          return `
          <li class="flow-item${branchClass}${endClass}${on ? " is-on" : ""}">
            ${s.branch ? `<span class="flow-branch-label">${s.num === "4a" ? "Pad A" : "Pad B"}</span>` : ""}
            <button type="button" class="flow-step human-${s.humanLevel}" data-proces="${i}" aria-pressed="${on}">
              <span class="flow-num">${escapeHtml(s.num)}</span>
              <span class="flow-body">
                <strong>${escapeHtml(s.title)}</strong>
                <span class="flow-who">${escapeHtml(whoLine(s))}</span>
              </span>
              <span class="flow-badge involve-${s.humanLevel}">${humanShort(s.humanLevel)}</span>
            </button>
          </li>`;
        })
        .join("")}
    </ol>
  `;

  renderProcesDetail();
}

function renderProcesDetail() {
  const s = REGIE.proces[state.activeProces];
  if (!s || !$("proces-detail")) return;

  $("proces-detail").innerHTML = `
    <div class="proces-detail-head">
      <p class="detail-kicker">Stap ${s.num} · ${humanLabel(s.humanLevel)}</p>
      <h3>${escapeHtml(s.title)}</h3>
    </div>

    <p class="detail-body">${escapeHtml(s.happens)}</p>

    <div class="proces-lanes">
      <div class="proces-card agent-card">
        <h4>Agents</h4>
        ${
          s.agentJobs && s.agentJobs.length
            ? `<ul class="job-list">${s.agentJobs
                .map(
                  (j) =>
                    `<li><strong>${escapeHtml(j.agent)}</strong><span>${escapeHtml(j.does)}</span></li>`
                )
                .join("")}</ul>`
            : `<p class="muted">Geen agent — wacht op Brand New Start.</p>`
        }
      </div>
      <div class="proces-card human-card human-${s.humanLevel}">
        <div class="proces-bns-mini">
          <img src="assets/bns-logo.png" alt="" class="proces-bns-logo" />
          <h4>Brand New Start</h4>
        </div>
        <ul class="job-list bns-jobs">
          ${(s.bnsJobs || []).map((j) => `<li><span>${escapeHtml(j)}</span></li>`).join("")}
        </ul>
      </div>
    </div>
  `;
}

/* —— Bronnen / Intel —— */
function renderIntel() {
  const sources = REGIE.intel.sources;
  const src = sources[state.activeIntel];
  $("intel-source-count").textContent = `${sources.length} typen · klik om uitleg te zien`;

  $("intel-source-list").innerHTML = sources
    .map((s, i) => {
      const on = i === state.activeIntel;
      const hits = REGIE.intel.feed.filter((f) => f.source === s.id).length;
      return `
      <li>
        <button type="button" class="intel-source-item${on ? " is-on" : ""}" data-intel="${i}">
          <span class="intel-source-top">
            <strong>${escapeHtml(s.title)}</strong>
            ${hits ? `<span class="intel-hit">${hits} live</span>` : ""}
          </span>
          <span class="intel-fetch">${escapeHtml(s.fetchFrom)}</span>
          <span class="intel-strength">${escapeHtml(s.strength)}</span>
        </button>
      </li>`;
    })
    .join("");

  $("intel-source-detail").innerHTML = `
    <p class="detail-kicker">${escapeHtml(src.agent)} · ${escapeHtml(src.strength)}</p>
    <h3>${escapeHtml(src.title)}</h3>

    <div class="intel-where">
      <h4 class="detail-sub">Waar halen we dit op?</h4>
      <p class="intel-fetch-big">${escapeHtml(src.fetchFrom)}</p>
    </div>

    <h4 class="detail-sub">Waarom dit een contracting-signaal is</h4>
    <p class="detail-body">${escapeHtml(src.why)}</p>

    <h4 class="detail-sub">Wat de agent ermee doet</h4>
    <p>${escapeHtml(src.how)}</p>

    <h4 class="detail-sub">Voorbeeld</h4>
    <p class="intel-example">${escapeHtml(src.example)}</p>

    <div class="approve-actions" style="margin-top:0.85rem">
      ${
        src.id === "pulse"
          ? `<button type="button" class="btn btn-ghost btn-sm" id="btn-intel-pulse">Open Pulse</button>`
          : ""
      }
    </div>
  `;

  $("btn-intel-pulse")?.addEventListener("click", () => setMode("pulse"));

  const feed = REGIE.intel.feed;
  const visible = state.feedExpanded ? feed : feed.slice(0, FEED_PREVIEW);
  const hiddenCount = Math.max(0, feed.length - FEED_PREVIEW);

  if ($("intel-feed-count")) {
    $("intel-feed-count").textContent = state.feedExpanded
      ? `${feed.length} signalen · klik een kaart om de bron te openen`
      : `${Math.min(FEED_PREVIEW, feed.length)} van ${feed.length} · nieuwste bovenaan`;
  }

  $("intel-feed").innerHTML = visible
    .map((f) => {
      const source = sources.find((s) => s.id === f.source);
      const srcIdx = sources.findIndex((s) => s.id === f.source);
      const active = srcIdx === state.activeIntel;
      return `
      <li>
        <button type="button" class="intel-feed-card${active ? " is-related" : ""}" data-feed-src="${srcIdx}">
          <div class="intel-feed-card-top">
            <span class="intel-when">${escapeHtml(f.when)}</span>
            <span class="intel-score">kans ${f.score}</span>
          </div>
          <strong>${escapeHtml(f.company)}</strong>
          <span class="intel-feed-signal">${escapeHtml(f.signal)}</span>
          <div class="intel-feed-card-foot">
            <span class="src-chip">${escapeHtml(source?.title || f.source)}</span>
            <span class="intel-feed-action">${escapeHtml(f.action)}</span>
          </div>
          <span class="intel-feed-from muted">ophalen: ${escapeHtml(source?.fetchFrom || "—")}</span>
        </button>
      </li>`;
    })
    .join("");

  const more = $("intel-feed-more");
  if (more) {
    if (hiddenCount > 0) {
      more.hidden = false;
      more.innerHTML = state.feedExpanded
        ? `<button type="button" class="btn btn-ghost btn-sm" data-feed-toggle>Toon minder</button>`
        : `<button type="button" class="btn btn-ghost btn-sm" data-feed-toggle>Toon ${hiddenCount} oudere signalen</button>`;
    } else {
      more.hidden = true;
      more.innerHTML = "";
    }
  }
}

function leadKandidaat() {
  return REGIE.kandidaten.find((k) => k.id === REGIE.opdracht.leadKandidaat) || REGIE.kandidaten[0];
}

function renderOpdracht() {
  const o = REGIE.opdracht;
  const lead = leadKandidaat();
  $("opdracht").innerHTML = `
    <div class="opdracht-main">
      <p class="opdracht-id">${escapeHtml(o.klant)} · ${escapeHtml(o.id)}</p>
      <h1>${escapeHtml(o.titel)}</h1>
      <p class="opdracht-meta">${escapeHtml(o.locatie)} · ${escapeHtml(o.tarief)}</p>
      <p class="opdracht-story">${escapeHtml(o.story)}</p>
    </div>
    <div class="opdracht-side">
      <dl class="opdracht-facts">
        <div><dt>Start</dt><dd>${escapeHtml(o.start)}</dd></div>
        <div><dt>Posted</dt><dd>${escapeHtml(o.employmentPosted)}</dd></div>
        <div><dt>Aanpak</dt><dd>Interim-pitch</dd></div>
      </dl>
      <div class="opdracht-lead">
        <p class="opdracht-lead-kicker">Lead-kandidaat</p>
        <strong>${escapeHtml(lead.naam)}</strong>
        <span class="muted">${lead.score}% match · €${lead.tarief}/u · start ${escapeHtml(lead.beschikbaar)}</span>
        <p>${escapeHtml(o.leadWhy)}</p>
      </div>
    </div>
  `;
}

function renderSteps() {
  $("steps").innerHTML = REGIE.steps
    .map((s, i) => {
      const status = state.approvals[s.id];
      return `
      <li>
        <button type="button" class="step${i === state.activeStep ? " is-active" : ""}${
          status === "approved" ? " is-approved" : ""
        }${status === "override" ? " is-override" : ""}" data-index="${i}" aria-pressed="${i === state.activeStep}">
          <span class="step-num">0${s.id}</span>
          <span class="step-label">${s.label}</span>
          <span class="step-status">${status === "approved" ? "✓" : status === "override" ? "~" : ""}</span>
        </button>
      </li>`;
    })
    .join("");
}

function shortView(step) {
  const lead = leadKandidaat();
  const o = REGIE.opdracht;

  if (step.view === "intake") {
    return `
      <div class="step-brief">
        <p><strong>Klantvraag:</strong> ${escapeHtml(o.titel)} bij ${escapeHtml(o.klant)} (${escapeHtml(o.employmentPosted)}).</p>
        <p><strong>Jullie angle:</strong> ${escapeHtml(o.contractingAngle)}</p>
        <div class="chips" style="margin-top:0.65rem">${o.mustHaves
          .slice(0, 5)
          .map((t) => `<span class="chip chip-must">${escapeHtml(t)}</span>`)
          .join("")}</div>
      </div>`;
  }

  if (step.view === "match") {
    return `
      <div class="match">
        <div class="match-score"><span class="match-num">${lead.score}%</span></div>
        <div>
          <strong>${escapeHtml(lead.naam)}</strong>
          <p class="muted" style="margin:0.25rem 0">${escapeHtml(lead.waaromLead || "")}</p>
          <div class="chips" style="margin-top:0.5rem">${lead.sterke
            .map((s) => `<span class="chip chip-must">${escapeHtml(s)}</span>`)
            .join("")}</div>
          <p class="risk" style="margin-top:0.5rem">Risico: ${escapeHtml(lead.risico)}</p>
        </div>
      </div>`;
  }

  if (step.view === "screening") {
    return `
      <p class="step-brief-note">Screening van <strong>${escapeHtml(lead.naam)}</strong> — niet van de hele shortlist.</p>
      <div class="chat">${REGIE.screeningChat
        .slice(0, 8)
        .map((m) => `<div class="bubble bubble-${m.from}"><p>${escapeHtml(m.text)}</p></div>`)
        .join("")}</div>`;
  }

  if (step.view === "voorstel") {
    return `
      <p class="step-brief-note">Concept naar Adyen over <strong>${escapeHtml(lead.naam)}</strong>. Jij keurt toon &amp; feiten.</p>
      <textarea id="mail-body" class="mail-body" rows="8">${escapeHtml(state.voorstelBody)}</textarea>
      <div class="mail-actions">
        <button type="button" class="btn btn-primary btn-sm" id="mail-send">Keur voorstel</button>
      </div>`;
  }

  if (step.view === "sourcing") {
    return `
      <p class="step-brief-note">Agent-ranking. <strong>${escapeHtml(lead.naam)}</strong> staat #1 — jij bevestigt of overrulet.</p>
      <ul class="rank-list">${REGIE.kandidaten
        .map(
          (c, i) =>
            `<li class="${c.id === lead.id ? "is-lead" : ""}">
              <span class="rank-score">${c.score}%</span>
              <div>
                <strong>${escapeHtml(c.naam)}${c.id === lead.id ? " · lead" : " · backup"}</strong>
                <span class="muted">€${c.tarief}/u · start ${escapeHtml(c.beschikbaar)}</span>
                <span class="muted">${escapeHtml(c.waaromLead || c.risico)}</span>
              </div>
            </li>`
        )
        .join("")}</ul>`;
  }

  if (step.view === "planning") {
    return `
      <p class="step-brief-note">Voorgestelde slots voor gesprekken over ${escapeHtml(lead.naam)}.</p>
      <ul class="rank-list">${REGIE.planning
        .map(
          (p) =>
            `<li><span class="rank-score">${escapeHtml(p.status)}</span><div><strong>${escapeHtml(p.dag)} · ${escapeHtml(p.slot)}</strong><span class="muted">${escapeHtml(p.met)}</span></div></li>`
        )
        .join("")}</ul>`;
  }

  if (step.view === "followup") {
    return `
      <ul class="rank-list">${REGIE.followUps
        .map(
          (f) =>
            `<li><span class="rank-score">${escapeHtml(f.wanneer)}</span><div><strong>${escapeHtml(f.wie)}</strong><span class="muted">${escapeHtml(f.actie)}</span></div></li>`
        )
        .join("")}</ul>`;
  }

  if (step.view === "admin") {
    return `
      <ul class="rank-list">${REGIE.admin
        .map(
          (a) =>
            `<li><span class="rank-score">${escapeHtml(a.status)}</span><div><strong>${escapeHtml(a.item)}</strong></div></li>`
        )
        .join("")}</ul>`;
  }

  return `<div class="chips">${o.mustHaves
    .slice(0, 5)
    .map((t) => `<span class="chip chip-must">${escapeHtml(t)}</span>`)
    .join("")}</div>`;
}

function renderDetail() {
  const s = REGIE.steps[state.activeStep];
  const status = state.approvals[s.id];
  $("detail").innerHTML = `
    <p class="detail-kicker">Stap ${s.id} · ${escapeHtml(s.agent)} Agent</p>
    <h3>${escapeHtml(s.title)}</h3>
    <p class="detail-body">${escapeHtml(s.body)}</p>

    <div class="step-gate">
      <div class="step-gate-col">
        <h4>Agent heeft gedaan</h4>
        <p>${escapeHtml(s.agentDid)}</p>
      </div>
      <div class="step-gate-col step-gate-approve">
        <h4>Jij keurt goed</h4>
        <p>${escapeHtml(s.approveWhat)}</p>
      </div>
    </div>

    <div class="detail-view">${shortView(s)}</div>
    <div class="approve-bar">
      <span class="approve-state">${
        status === "approved" ? "goedgekeurd" : status === "override" ? "aangepast" : "wacht op jouw oordeel"
      }</span>
      <div class="approve-actions">
        <button type="button" class="btn btn-ghost" data-action="override">Aanpassen</button>
        <button type="button" class="btn btn-primary" data-action="approve">Goedkeuren</button>
      </div>
    </div>
  `;
  $("detail").querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.approvals[s.id] = btn.dataset.action === "approve" ? "approved" : "override";
      renderSteps();
      renderDetail();
    });
  });
  $("mail-body")?.addEventListener("input", (e) => {
    state.voorstelBody = e.target.value;
  });
  $("mail-send")?.addEventListener("click", () => {
    state.approvals[5] = "approved";
    renderSteps();
    renderDetail();
  });
}

function setStep(index) {
  state.activeStep = index;
  renderSteps();
  renderDetail();
}

/* —— Outreach —— */
function outreachStatus(id) {
  return state.outreachStatuses[id] || REGIE.demand.outreachQueue.find((o) => o.id === id)?.status || "draft";
}

function renderDemand() {
  $("outreach-list").innerHTML = REGIE.demand.outreachQueue
    .map((o, i) => {
      const st = outreachStatus(o.id);
      return `
      <li>
        <button type="button" class="outreach-item${i === state.activeOutreach ? " is-on" : ""}" data-outreach="${i}">
          <span class="outreach-co">${escapeHtml(o.company)}</span>
          <span class="muted">${escapeHtml(o.toName)}</span>
          <span class="slot-badge status-${st}">${st}</span>
        </button>
      </li>`;
    })
    .join("");
  renderOutreachDraft();
}

function renderOutreachDraft() {
  const o = REGIE.demand.outreachQueue[state.activeOutreach];
  const st = outreachStatus(o.id);
  $("outreach-draft").innerHTML = `
    <p class="detail-kicker">Naar: ${escapeHtml(o.toName)}</p>
    <h3>${escapeHtml(o.company)}</h3>
    <p class="muted" style="margin-bottom:0.5rem">${escapeHtml(o.whyNow)}</p>
    <textarea id="outreach-body" class="mail-body" rows="10">${escapeHtml(o.body)}</textarea>
    <div class="mail-actions">
      <span class="approve-state">${st}</span>
      <div class="approve-actions">
        <button type="button" class="btn btn-ghost" data-outreach-action="ready">Ready</button>
        <button type="button" class="btn btn-primary" data-outreach-action="sent">Verzonden</button>
      </div>
    </div>
  `;
  $("outreach-body")?.addEventListener("input", (e) => {
    o.body = e.target.value;
  });
  $("outreach-draft").querySelectorAll("[data-outreach-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.outreachStatuses[o.id] = btn.dataset.outreachAction;
      renderDemand();
    });
  });
}

function mountPulseTab() {
  const root = $("pulse-embed-root");
  if (!root || root.dataset.mounted === "1") return;
  window.PulseForm?.mount(root, { showDeskLink: false });
  root.dataset.mounted = "1";
}

/* —— Events —— */
document.querySelector(".mode-switch").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-mode]");
  if (btn) setMode(btn.dataset.mode);
});

$("radar-filters").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  state.radarFilter = btn.dataset.filter;
  document.querySelectorAll(".filter-btn").forEach((b) => b.classList.toggle("is-on", b === btn));
  renderRadar();
});

$("steps").addEventListener("click", (e) => {
  const btn = e.target.closest(".step");
  if (btn) setStep(Number(btn.dataset.index));
});

$("outreach-list").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-outreach]");
  if (!btn) return;
  state.activeOutreach = Number(btn.dataset.outreach);
  renderDemand();
});

$("radar-body").addEventListener("click", (e) => {
  const kans = e.target.closest("[data-kans]");
  if (kans) {
    e.stopPropagation();
    const r = REGIE.demand.radar[Number(kans.dataset.kans)];
    if (r) showFloatingTip(kans, kansTooltipHtml(r));
    return;
  }
  const row = e.target.closest("[data-radar]");
  if (!row) return;
  state.activeRadar = Number(row.dataset.radar);
  renderRadar();
});

$("radar-body").addEventListener("mouseover", (e) => {
  const kans = e.target.closest("[data-kans]");
  if (!kans || !$("radar-body").contains(kans)) return;
  const r = REGIE.demand.radar[Number(kans.dataset.kans)];
  if (r) showFloatingTip(kans, kansTooltipHtml(r));
});

$("radar-body").addEventListener("mouseout", (e) => {
  const kans = e.target.closest("[data-kans]");
  if (!kans) return;
  const to = e.relatedTarget;
  if (to && kans.contains(to)) return;
  hideFloatingTip();
});

$("radar-body").addEventListener("focusin", (e) => {
  const kans = e.target.closest("[data-kans]");
  if (!kans) return;
  const r = REGIE.demand.radar[Number(kans.dataset.kans)];
  if (r) showFloatingTip(kans, kansTooltipHtml(r));
});

$("radar-body").addEventListener("focusout", (e) => {
  const kans = e.target.closest("[data-kans]");
  if (!kans) return;
  const to = e.relatedTarget;
  if (to && kans.contains(to)) return;
  hideFloatingTip();
});

$("radar-body").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  if (e.target.closest("[data-kans]")) return;
  const row = e.target.closest("[data-radar]");
  if (!row) return;
  e.preventDefault();
  state.activeRadar = Number(row.dataset.radar);
  renderRadar();
});

$("info-gesprek")?.addEventListener("click", (e) => {
  e.stopPropagation();
  const btn = e.currentTarget;
  showFloatingTip(
    btn,
    `<strong>Gesprek gemeld</strong>
     <p style="margin:0.35rem 0 0;opacity:.9">Komt uit Pulse of screening: een kandidaat meldt een interview bij dit bedrijf.
     Vaak dun in het begin — maar als het er is, is het het sterkste contracting-signaal.
     Leeg = nog geen Pulse/screening-input, niet “geen activiteit”.</p>`
  );
});

$("info-gesprek")?.addEventListener("mouseenter", (e) => {
  showFloatingTip(
    e.currentTarget,
    `<strong>Gesprek gemeld</strong>
     <p style="margin:0.35rem 0 0;opacity:.9">Komt uit Pulse of screening: een kandidaat meldt een interview bij dit bedrijf.
     Vaak dun vroeg — maar als het er is, is het goud. Leeg ≠ geen activiteit.</p>`
  );
});

$("info-gesprek")?.addEventListener("mouseleave", () => hideFloatingTip());

window.addEventListener("scroll", hideFloatingTip, true);
window.addEventListener("resize", hideFloatingTip);

$("btn-tour")?.addEventListener("click", () => window.RegieTour?.start());

document.getElementById("schema")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-proces]");
  if (!btn) return;
  state.activeProces = Number(btn.dataset.proces);
  renderProces();
});

document.getElementById("intel-source-list")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-intel]");
  if (!btn) return;
  state.activeIntel = Number(btn.dataset.intel);
  renderIntel();
});

document.getElementById("intel-feed")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-feed-src]");
  if (!btn) return;
  const idx = Number(btn.dataset.feedSrc);
  if (Number.isNaN(idx) || idx < 0) return;
  state.activeIntel = idx;
  renderIntel();
  $("intel-source-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.getElementById("intel-feed-more")?.addEventListener("click", (e) => {
  if (!e.target.closest("[data-feed-toggle]")) return;
  state.feedExpanded = !state.feedExpanded;
  renderIntel();
});

document.getElementById("btn-intel-radar-top")?.addEventListener("click", () => setMode("radar"));

renderRadar();
renderOpdracht();
renderDemand();
renderProces();
renderIntel();
setStep(0);

const params = new URLSearchParams(location.search);
const requestedView = params.get("view");
const validView = requestedView && document.querySelector(`.mode-btn[data-mode="${requestedView}"]`);
setMode(validView ? requestedView : "radar");

if (params.get("demo") === "1") {
  setTimeout(() => window.RegieTour?.start(), 300);
}
