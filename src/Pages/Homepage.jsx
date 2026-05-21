import "./Homepage.css";

function Homepage() {
  return (
    <div className="homepage">
      <section className="homepage-hero">
        <div className="homepage-video-wrapper">
          <video
            className="homepage-video"
            src="/videos/opener.mp4"
            autoPlay
            muted
            loop
            playsInline
          >
            Dein Browser unterstützt keine Videos.
          </video>

          <div className="homepage-video-overlay">
            <p className="homepage-kicker">Valush präsentiert</p>
            <h1>Das zweite offizielle Bierpong Tunier</h1>
            <p className="homepage-hero-text">
              Ob Anfänger(Mato) oder Profi, hier ist für jeden etwas dabei. 
            </p>
          </div>
        </div>
      </section>

      <section className="homepage-info-section">
        <div className="homepage-section-content">
          <p className="homepage-kicker">Allgemeine Infos</p>
          <h2>Das Turnier</h2>

          <div className="homepage-info-grid">
            <div className="homepage-info-card">
              <h3>Teams</h3>
              <p>
                Mehrere Teams treten gegeneinander an und kämpfen sich durch den
                Turnierbaum bis ins Finale.
              </p>
            </div>

            <div className="homepage-info-card">
              <h3>Matches</h3>
              <p>
                Alle Spiele werden übersichtlich angezeigt, damit jeder den aktuellen
                Stand verfolgen kann.
              </p>
            </div>

            <div className="homepage-info-card">
              <h3>Host</h3>
              <p>
                Der Host kann Ergebnisse eintragen und den Fortschritt des Turniers
                aktuell halten.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="homepage-tree-section">
        <div className="homepage-tree-image">
          <div className="homepage-image-placeholder">
            <span>Placeholder: Turnierbaum Bild</span>
          </div>

          <div className="homepage-tree-overlay">
            <p className="homepage-kicker">Live Bracket</p>
            <h2>Zum Turnierbaum</h2>
            <p>
              Sieh dir alle Begegnungen, Runden und Gewinner im Turnierbaum an.
            </p>

            <a className="homepage-button" href="#tournament-tree">
              Turnierbaum öffnen
            </a>
          </div>
        </div>
      </section>

      <section className="homepage-winners-section">
  <div className="homepage-section-content">
    <p className="homepage-kicker">Hall of Fame</p>
    <h2>Legenden des Turniers</h2>

    <div className="homepage-highlights-grid">
      <div className="homepage-highlight-block">
        <h3>Gewinner vom letzten Jahr</h3>

        <div className="homepage-winner-image">
          <img
            className="homepage-real-image"
            src={`${process.env.PUBLIC_URL}/TeamGewinner.jpg`}
            alt="Gewinner vom letzten Jahr"
          />
        </div>
      </div>

      <div className="homepage-highlight-block">
        <h3>Team mit der meisten Aura</h3>

        <div className="homepage-aura-image">
          <img
            className="homepage-real-image"
            src={`${process.env.PUBLIC_URL}/TeamAura.jpg`}
            alt="Team mit der meisten Aura"
          />
        </div>
      </div>
    </div>
  </div>
</section>
    </div>
  );
}

export default Homepage;