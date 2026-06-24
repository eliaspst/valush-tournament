import "./RulesPages.css";

function RulesPage() {
  const ruleSections = [
    {
      title: "Spielaufbau",
      icon: "🍺",
      rules: [
        "Alle Partien werden mit 6 Bechern pro Team gespielt.",
        "Die Becher werden mit Wasser gefüllt.",
        "Die Becher dürfen pro Team 1 Mal umgestellt werden.",
        "Inseln setzen zählt nicht."
      ]
    },
    {
      title: "Spielstart",
      icon: "✊",
      rules: [
        "Am Anfang wird bis 1 geschnickt.",
        "Der Gewinner darf entscheiden, ob sein Team anfängt oder den Rückwurf nimmt."
      ]
    },
    {
      title: "Wurfregeln",
      icon: "🎯",
      rules: [
        "Jeder Spieler wirft genau einen Ball.",
        "Dass ein Spieler beide Bälle wirft, Gastwürfe oder Ähnliches sind nicht erlaubt.",
        "Es gilt die Ellenbogen-Regel.",
        "Bälle aus dem Becher pusten zählt nicht."
      ]
    },
    {
      title: "Treffer & Sonderregeln",
      icon: "🔥",
      rules: [
        "Bei einem Bounce Back erhält der Werfer einen Trickshot.",
        "Bei einem Aufpraller kommen zwei Becher weg. Der Aufpraller darf aber abgeblockt werden.",
        "Werden beide Bälle in unterschiedliche Becher geworfen, gibt es Balls Back.",
        "Treffen beide Spieler in denselben Becher, gibt es Balls Back und es kommen 3 Becher weg.",
        "Trifft jemand 3 Würfe in Folge, ist er on fire. Er darf ab dann so lange weiterwerfen, bis er einen Wurf verfehlt."
      ]
    },
    {
      title: "Strafen",
      icon: "⚠️",
      rules: [
        "Werden zwei Airballs hintereinander geworfen, kommt ein Becher vom Werfer-Team weg.",
        "Zusätzlich müssen beide Spieler des Werfer-Teams einen Shot trinken.",
        "Erst danach wird das Spiel fortgesetzt."
      ]
    },
    {
      title: "Wichtigste Regel",
      icon: "🏆",
      rules: [
        "Nach jeder Runde muss das Gewinner-Duo sein Bier, seine Mische, seinen Wein oder Ähnliches leer haben.",
        "Ansonsten gilt das Spiel als verloren."
      ],
      highlight: true
    },

    {
      title: "Tabelle",
      icon: "📊",
      rules: [
        "Die Plätze 1 und 2 sowie die vier besten Dritten kommen in die K.O Phase.",
        "Bei Punktgleichheit entscheidet die Differenz der erzielten und kassierten Becher.",
      
      ]
    },
  ];

  return (
    <main className="rules-page">
      <section className="rules-hero">
        <div className="rules-hero-content">
          <p className="rules-kicker">Valush Bierpong Turnier 2026</p>
          <h1>Spielregeln</h1>
          <p>
            Damit es keine Diskussionen gibt: Hier findest du alle offiziellen
            Regeln für das Turnier.
          </p>
        </div>
      </section>

      <section className="rules-content">
        <div className="rules-grid">
          {ruleSections.map((section) => (
            <article
              className={
                section.highlight
                  ? "rules-card rules-card-highlight"
                  : "rules-card"
              }
              key={section.title}
            >
              <div className="rules-card-header">
                <span className="rules-icon">{section.icon}</span>
                <h2>{section.title}</h2>
              </div>

              <ul>
                {section.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default RulesPage;