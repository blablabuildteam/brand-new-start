window.RegieTour = (() => {
  const STEPS = [
    {
      title: "Voor Brand New Start",
      body: "Prototype command center: agents vinden signalen en bereiden werk voor; jullie houden de regie. Elke tab heeft bovenaan een korte uitleg.",
      mode: "radar",
      target: null,
    },
    {
      title: "Radar",
      body: "Waar is contracting-ruimte? Klik een bedrijf → bronnen, kans-opbouw, volgende stap (agent of zelf).",
      mode: "radar",
      target: "[data-tour='radar-table']",
    },
    {
      title: "Bronnen",
      body: "Hoe signalen binnenkomen: aanbestedingen, HM-posts, Pulse, CRM… Meer bronnen = sterkere kans op de radar.",
      mode: "intel",
      target: "[data-tour='intel-sources']",
    },
    {
      title: "Opdracht",
      body: "Concrete klantvraag (Adyen). Agents leveren stappen; jij keurt per poort goed. Samira = lead-kandidaat.",
      mode: "delivery",
      target: "[data-tour='flow']",
      action: () => window.RegieApp?.setStep?.(0),
    },
    {
      title: "Outreach",
      body: "Conceptberichten naar hiring managers. Jullie toon, jullie relatie — agent schrijft het concept.",
      mode: "demand",
      target: "[data-tour='outreach']",
    },
    {
      title: "Pulse",
      body: "Formulier voor kandidaten: tariefsnapshot terug, interview-signalen naar de radar.",
      mode: "pulse",
      target: "[data-tour='pulse-tab']",
    },
    {
      title: "Proces",
      body: "Wie doet wat: agents vs Brand New Start (licht / keurt goed / beslist).",
      mode: "proces",
      target: "[data-tour='proces']",
    },
  ];

  let index = 0;
  let active = false;
  let lastTarget = null;

  function clearSpotlight() {
    lastTarget?.classList.remove("tour-spotlight");
    lastTarget = null;
  }

  function render() {
    const root = document.getElementById("tour-root");
    if (!root || !active) {
      if (root) root.innerHTML = "";
      clearSpotlight();
      return;
    }

    const step = STEPS[index];
    if (step.mode) window.RegieApp?.setMode?.(step.mode);
    if (typeof step.action === "function") step.action();
    clearSpotlight();
    if (step.target) {
      const el = document.querySelector(step.target);
      if (el) {
        el.classList.add("tour-spotlight");
        lastTarget = el;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    root.innerHTML = `
      <div class="tour-backdrop" role="dialog" aria-modal="true">
        <div class="tour-card">
          <p class="tour-progress">${index + 1} / ${STEPS.length}</p>
          <h2>${step.title}</h2>
          <p>${step.body}</p>
          <div class="tour-actions">
            <button type="button" class="btn btn-ghost" data-tour-nav="skip">Sluiten</button>
            <div class="approve-actions">
              ${index > 0 ? `<button type="button" class="btn btn-ghost" data-tour-nav="prev">Terug</button>` : ""}
              <button type="button" class="btn btn-primary" data-tour-nav="next">${
                index === STEPS.length - 1 ? "Klaar" : "Volgende"
              }</button>
            </div>
          </div>
        </div>
      </div>`;

    root.querySelectorAll("[data-tour-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nav = btn.dataset.tourNav;
        if (nav === "skip" || (nav === "next" && index === STEPS.length - 1)) {
          active = false;
          render();
          return;
        }
        if (nav === "prev") index -= 1;
        if (nav === "next") index += 1;
        render();
      });
    });
  }

  return {
    start() {
      index = 0;
      active = true;
      render();
    },
    stop() {
      active = false;
      render();
    },
  };
})();
