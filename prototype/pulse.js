/* Pulse — stapsgewijs formulier: kandidaat vult in → tariefsnapshot terug */
window.PulseForm = (() => {
  const STEPS = [
    {
      id: "profiel",
      title: "Wie ben je?",
      sub: "30 seconden — daarna zie je meteen waar je tarief staat",
      fields: [
        { name: "name", label: "Voornaam", type: "text", placeholder: "Samira", required: true },
        {
          name: "role",
          label: "Jouw stack / rol",
          type: "chips",
          required: true,
          options: [
            "Cloud / Infra",
            "Platform / DevOps",
            "Backend",
            "Frontend",
            "Data / ML",
            "Security",
            "Anders",
          ],
        },
        {
          name: "tarief",
          label: "Wat vraag je nu per uur (excl.)?",
          type: "range",
          required: true,
          min: 70,
          max: 160,
          step: 5,
          default: 110,
        },
      ],
    },
    {
      id: "markt",
      title: "Waar speelt het?",
      sub: "Dit is optioneel voor jou — goud voor betere matches",
      fields: [
        {
          name: "company",
          label: "Waar interview je (of oriënteer je)?",
          type: "text",
          placeholder: "Adyen · fintech AMS · liever anoniem",
          required: false,
          help: "Anoniem mag. Helpt Brand New Start zien waar contracting-ruimte is.",
        },
        {
          name: "stage",
          label: "Fase",
          type: "choice",
          required: true,
          options: [
            { value: "none", label: "Nog niet — oriënterend" },
            { value: "screen", label: "Recruiter screen" },
            { value: "hm", label: "1e gesprek" },
            { value: "tech", label: "Tech / assignment" },
            { value: "final", label: "Finale / offer" },
          ],
        },
        {
          name: "contract",
          label: "Is ZZP / interim besproken?",
          type: "choice",
          required: true,
          options: [
            { value: "ja", label: "Ja" },
            { value: "misschien", label: "Misschien" },
            { value: "nee", label: "Nee, alleen vast" },
            { value: "weet-niet", label: "Weet ik niet" },
          ],
        },
        {
          name: "when",
          label: "Wanneer kun je starten?",
          type: "choice",
          required: true,
          options: [
            { value: "nu", label: "Direct" },
            { value: "2w", label: "Binnen 2 weken" },
            { value: "1m", label: "Binnen 1 maand" },
            { value: "later", label: "Later / flexibel" },
          ],
        },
      ],
    },
    { id: "result", title: "Jouw snapshot", sub: "Gratis, meteen, geen account" },
  ];

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bandFor(tarief, role, contract) {
    const t = Number(tarief) || 100;
    const cloud = /cloud|infra|platform|devops|aws|backend|security/i.test(role || "");
    const low = cloud ? 105 : 90;
    const high = cloud ? 128 : 115;
    let pos = "goed in de band";
    let tip = "Je zit in een gezonde range voor AMS senior contracting.";
    if (t < low) {
      pos = "aan de scherpe kant";
      tip = "Er is ruimte omhoog — vooral met schaarse cloud/infra-diepte.";
    } else if (t > high) {
      pos = "aan de bovenkant";
      tip = "Verkoop met senioriteit; check of de klant ZZP accepteert.";
    }
    if (contract === "ja") tip += " ZZP is al besproken — sterk signaal.";
    return { low, high, pos, tip, cloud, t };
  }

  function mount(root, opts = {}) {
    if (!root) return;
    const state = {
      step: 0,
      data: {
        name: "",
        role: "",
        tarief: "110",
        company: "",
        stage: "",
        contract: "",
        when: "",
      },
    };

    function render() {
      const step = STEPS[state.step];
      const progress = ((state.step + 1) / STEPS.length) * 100;

      if (step.id === "result") {
        const { low, high, pos, tip, cloud } = bandFor(
          state.data.tarief,
          state.data.role,
          state.data.contract
        );
        try {
          const prev = JSON.parse(localStorage.getItem("regie-pulse") || "[]");
          prev.unshift({ ...state.data, at: new Date().toISOString() });
          localStorage.setItem("regie-pulse", JSON.stringify(prev.slice(0, 30)));
        } catch {
          /* ignore */
        }

        const barPct = Math.min(
          100,
          Math.max(0, ((Number(state.data.tarief) - low) / (high - low + 0.01)) * 100)
        );

        root.innerHTML = `
          <div class="pulse-card pulse-wizard">
            <div class="pulse-progress"><span style="width:${progress}%"></span></div>
            <p class="pulse-step-label">Klaar · ~90 sec</p>
            <h1>Snapshot voor ${escapeHtml(state.data.name)}</h1>
            <p class="lede">Geen account. Dit is wat de markt ongeveer doet voor jouw profiel.</p>

            <div class="pulse-band">
              <div class="pulse-band-labels">
                <span>€${low}</span>
                <span>marktband</span>
                <span>€${high}</span>
              </div>
              <div class="pulse-band-track">
                <i style="left:${barPct}%"></i>
              </div>
              <p class="pulse-band-you">Jij vraagt <strong>€${escapeHtml(state.data.tarief)}</strong> — ${pos}</p>
            </div>

            <p><strong>Tip:</strong> ${tip}</p>
            <div class="pulse-value" style="margin-top:1rem">
              <strong>Wat jij hieraan hebt</strong>
              <span>· Weet waar je staat t.o.v. AMS contracting</span>
              <span>· Brand New Start benadert je alleen bij een passende opdracht</span>
              ${
                state.data.company
                  ? `<span>· Signaal gelogd voor ${escapeHtml(state.data.company)} (radar)</span>`
                  : `<span>· Geen bedrijf genoemd — prima, tariefcheck staat</span>`
              }
            </div>
            <div class="pulse-nav">
              <button type="button" class="btn btn-ghost" data-pulse-nav="again">Opnieuw</button>
              ${
                opts.showDeskLink !== false
                  ? `<a class="btn btn-primary" href="index.html">Naar Command Center</a>`
                  : `<button type="button" class="btn btn-primary" data-pulse-nav="again">Nog een keer</button>`
              }
            </div>
          </div>`;
        root.querySelectorAll("[data-pulse-nav='again']").forEach((btn) => {
          btn.addEventListener("click", () => {
            state.step = 0;
            state.data = {
              name: "",
              role: "",
              tarief: "110",
              company: "",
              stage: "",
              contract: "",
              when: "",
            };
            render();
          });
        });
        return;
      }

      const liveBand =
        step.id === "profiel" && state.data.tarief
          ? bandFor(state.data.tarief, state.data.role || "Cloud", state.data.contract)
          : null;

      root.innerHTML = `
        <div class="pulse-card pulse-wizard">
          <div class="pulse-progress"><span style="width:${progress}%"></span></div>
          <p class="pulse-step-label">Stap ${state.step + 1} van ${STEPS.length - 1}</p>
          <h1>${escapeHtml(step.title)}</h1>
          <p class="lede">${escapeHtml(step.sub)}</p>
          ${
            state.step === 0
              ? `<div class="pulse-value">
                  <strong>Wat jij terugkrijgt</strong>
                  <span>· Indicatie uurtarief voor jouw profiel</span>
                  <span>· Tip over ZZP vs vast — geen spam</span>
                </div>`
              : `<div class="pulse-value">
                  <strong>Waarom dit vragen?</strong>
                  <span>· Helpt ons zien waar interviews lopen (radar)</span>
                  <span>· Jij krijgt betere matches, geen koude calls</span>
                </div>`
          }
          <form class="form-stack" id="pulse-step-form">
            ${step.fields
              .map((f) => {
                if (f.type === "choice") {
                  return `
                  <fieldset class="pulse-choices">
                    <legend>${escapeHtml(f.label)}</legend>
                    <div class="choice-grid">
                      ${f.options
                        .map(
                          (o) => `
                        <label class="pulse-choice${state.data[f.name] === o.value ? " is-on" : ""}">
                          <input type="radio" name="${f.name}" value="${o.value}" ${
                            state.data[f.name] === o.value ? "checked" : ""
                          } ${f.required ? "required" : ""} />
                          <span>${escapeHtml(o.label)}</span>
                        </label>`
                        )
                        .join("")}
                    </div>
                  </fieldset>`;
                }
                if (f.type === "chips") {
                  return `
                  <fieldset class="pulse-choices">
                    <legend>${escapeHtml(f.label)}</legend>
                    <div class="chip-pick">
                      ${f.options
                        .map(
                          (o) => `
                        <label class="pulse-chip${state.data[f.name] === o ? " is-on" : ""}">
                          <input type="radio" name="${f.name}" value="${escapeHtml(o)}" ${
                            state.data[f.name] === o ? "checked" : ""
                          } ${f.required ? "required" : ""} />
                          <span>${escapeHtml(o)}</span>
                        </label>`
                        )
                        .join("")}
                    </div>
                  </fieldset>`;
                }
                if (f.type === "range") {
                  const v = state.data[f.name] || f.default;
                  return `
                  <div class="field field-range">
                    <label for="pf-${f.name}">${escapeHtml(f.label)}
                      <em class="range-val">€${escapeHtml(v)}</em>
                    </label>
                    <input id="pf-${f.name}" name="${f.name}" type="range"
                      min="${f.min}" max="${f.max}" step="${f.step || 1}"
                      value="${escapeHtml(v)}" required />
                    <div class="range-ends"><span>€${f.min}</span><span>€${f.max}</span></div>
                    ${
                      liveBand
                        ? `<p class="live-hint">Live: marktband ≈ <strong>€${liveBand.low}–${liveBand.high}</strong> · jij zit ${liveBand.pos}</p>`
                        : ""
                    }
                  </div>`;
                }
                return `
                <div class="field">
                  <label for="pf-${f.name}">${escapeHtml(f.label)}</label>
                  ${f.help ? `<span class="help">${escapeHtml(f.help)}</span>` : ""}
                  <input id="pf-${f.name}" name="${f.name}" type="${f.type}"
                    value="${escapeHtml(state.data[f.name])}"
                    placeholder="${escapeHtml(f.placeholder || "")}"
                    ${f.required ? "required" : ""} />
                </div>`;
              })
              .join("")}
            <div class="pulse-nav">
              ${
                state.step > 0
                  ? `<button type="button" class="btn btn-ghost" data-pulse-nav="back">Terug</button>`
                  : `<span></span>`
              }
              <button type="submit" class="btn btn-primary">${
                state.step === STEPS.length - 2 ? "Toon mijn snapshot" : "Verder"
              }</button>
            </div>
          </form>
        </div>`;

      const form = root.querySelector("#pulse-step-form");
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        step.fields.forEach((f) => {
          const v = fd.get(f.name);
          if (v != null && String(v).length) state.data[f.name] = String(v);
        });
        if (step.fields.some((f) => f.required && !state.data[f.name])) return;
        state.step += 1;
        render();
      });

      const range = root.querySelector('input[type="range"]');
      range?.addEventListener("input", () => {
        state.data.tarief = range.value;
        const label = root.querySelector(".range-val");
        if (label) label.textContent = `€${range.value}`;
        const hint = root.querySelector(".live-hint");
        if (hint) {
          const b = bandFor(range.value, state.data.role || "Cloud", state.data.contract);
          hint.innerHTML = `Live: marktband ≈ <strong>€${b.low}–${b.high}</strong> · jij zit ${b.pos}`;
        }
      });

      root.querySelectorAll(".pulse-choice input, .pulse-chip input").forEach((input) => {
        input.addEventListener("change", () => {
          state.data[input.name] = input.value;
          root.querySelectorAll(`input[name="${input.name}"]`).forEach((el) => {
            el.closest("label")?.classList.toggle("is-on", el.checked);
          });
          if (input.name === "role") {
            const hint = root.querySelector(".live-hint");
            const r = root.querySelector('input[type="range"]');
            if (hint && r) {
              const b = bandFor(r.value, input.value, state.data.contract);
              hint.innerHTML = `Live: marktband ≈ <strong>€${b.low}–${b.high}</strong> · jij zit ${b.pos}`;
            }
          }
        });
      });

      root.querySelector("[data-pulse-nav='back']")?.addEventListener("click", () => {
        state.step = Math.max(0, state.step - 1);
        render();
      });
    }

    render();
  }

  return { mount };
})();
