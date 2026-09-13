type BeatKind = "spot" | "weigh" | "place";

/** Mini product scenes for the “Hoe het werkt” steps. */
export function ScoutBeatVisual({ kind }: { kind: BeatKind }) {
  if (kind === "spot") {
    return (
      <div className="beat-viz beat-viz--spot" aria-hidden>
        <div className="beat-viz__radar">
          <span className="beat-viz__ring" />
          <span className="beat-viz__ring beat-viz__ring--2" />
          <span className="beat-viz__sweep" />
          <span className="beat-viz__dot" />
        </div>
        <div className="beat-viz__chip">
          <span className="beat-viz__chip-dot" />
          Nieuwe opdracht
        </div>
      </div>
    );
  }

  if (kind === "weigh") {
    return (
      <div className="beat-viz beat-viz--weigh" aria-hidden>
        <div className="beat-viz__rank">
          <div className="beat-viz__row beat-viz__row--hot">
            <span className="beat-viz__label">Interim CFO</span>
            <span className="beat-viz__bar">
              <i style={{ width: "94%" }} />
            </span>
            <span className="beat-viz__n">94</span>
          </div>
          <div className="beat-viz__row">
            <span className="beat-viz__label">ZZP Data</span>
            <span className="beat-viz__bar">
              <i style={{ width: "81%" }} />
            </span>
            <span className="beat-viz__n">81</span>
          </div>
          <div className="beat-viz__row">
            <span className="beat-viz__label">CISO</span>
            <span className="beat-viz__bar">
              <i style={{ width: "68%" }} />
            </span>
            <span className="beat-viz__n">68</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="beat-viz beat-viz--place" aria-hidden>
      <div className="beat-viz__mail">
        <div className="beat-viz__mail-top">
          <span className="beat-viz__avatar" />
          <div className="beat-viz__mail-meta">
            <span className="beat-viz__mail-to">Aan hiring manager</span>
            <span className="beat-viz__mail-sub">Kandidaat + pitch klaar</span>
          </div>
        </div>
        <div className="beat-viz__lines">
          <span />
          <span />
          <span className="beat-viz__lines-short" />
        </div>
        <div className="beat-viz__send">Verstuur</div>
      </div>
    </div>
  );
}
