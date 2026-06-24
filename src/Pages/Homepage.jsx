import "./Homepage.css";

function Homepage() {
  return (
    <div className="homepage">
      <section className="homepage-hero">
        <div className="homepage-video-wrapper">
          <img
            className="homepage-real-image"
            src={`${process.env.PUBLIC_URL}/MainBild.jpg`}
            alt="Team mit der meisten Aura"
          />

          <div className="homepage-video-overlay">
            
              <p className="homepage-hero-kicker-green">
              THE TABLES ARE READY
            </p>

            <h1>Valush Bierpong Tunier 2026
            </h1>
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
              <h3>Ort</h3>
              <p>
                Das Tunier findet in Valush Garten in Möhringen statt.
              </p>
            </div>

            <div className="homepage-info-card">
              <h3>Tunierstart</h3>
              <p>
                Das Tunier beginnt am 27. Juni 2026 um 14:15 Uhr. Sei pünktlich!
              </p>
            </div>

            <div className="homepage-info-card">
              <h3>Spielregelen</h3>
              <p>
                Alle Regeln findest du in unserem Regelwerk. Dafür klicke: <a href="#/rules">hier</a>
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

            <a className="homepage-button" href="#/turnierbaum">
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
    </div>
  </div>
</section>
    </div>
  );
}

export default Homepage;