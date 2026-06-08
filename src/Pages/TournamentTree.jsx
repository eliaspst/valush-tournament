import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import defaultGroups from "../data/defaultGroups";
import "./TournamentTree.css";

function createBracketTeam(team, groupName, placement) {
  const groupLetter = groupName.replace("Gruppe ", "");

  return {
    name: team.name,
    points: team.points,
    seed: `${groupLetter}${placement}`,
    groupName
  };
}

function createPlaceholderTeam(name) {
  return {
    name,
    points: null,
    seed: "",
    groupName: ""
  };
}

function hasPoints(team) {
  return typeof team.points === "number";
}

function TournamentTree() {
  const [groups, setGroups] = useState(defaultGroups);
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState("");

  useEffect(() => {
    const tournamentRef = doc(db, "tournaments", "current");

    const unsubscribe = onSnapshot(
      tournamentRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const tournamentData = snapshot.data();

          if (tournamentData.groups) {
            setGroups(tournamentData.groups);
          }
        } else {
          setGroups(defaultGroups);
        }

        setIsLoading(false);
      },
      () => {
        setFirebaseError("Die Turnierdaten konnten nicht geladen werden.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <main className="tournament-page">
        <section className="tournament-hero">
          <div className="tournament-hero-content">
            <p className="tournament-kicker">Live Bracket</p>
            <h1>Lädt...</h1>
            <p>Die Turnierdaten werden geladen.</p>
          </div>
        </section>
      </main>
    );
  }

  const sortedGroups = groups.map((group) => ({
    ...group,
    teams: [...group.teams].sort((teamA, teamB) => {
      if (teamB.points !== teamA.points) {
        return teamB.points - teamA.points;
      }

      return teamA.name.localeCompare(teamB.name);
    })
  }));

  const groupWinners = sortedGroups.map((group) =>
    createBracketTeam(group.teams[0], group.name, 1)
  );

  const bestSecondPlaces = sortedGroups
    .map((group) => createBracketTeam(group.teams[1], group.name, 2))
    .sort((teamA, teamB) => {
      if (teamB.points !== teamA.points) {
        return teamB.points - teamA.points;
      }

      return teamA.name.localeCompare(teamB.name);
    })
    .slice(0, 2);

  const bracketRounds = [
    {
      name: "Viertelfinale",
      matches: [
        {
          top: groupWinners[0] || createPlaceholderTeam("Offen"),
          bottom: bestSecondPlaces[0] || createPlaceholderTeam("Offen")
        },
        {
          top: groupWinners[1] || createPlaceholderTeam("Offen"),
          bottom: bestSecondPlaces[1] || createPlaceholderTeam("Offen")
        },
        {
          top: groupWinners[2] || createPlaceholderTeam("Offen"),
          bottom: groupWinners[5] || createPlaceholderTeam("Offen")
        },
        {
          top: groupWinners[3] || createPlaceholderTeam("Offen"),
          bottom: groupWinners[4] || createPlaceholderTeam("Offen")
        }
      ]
    },
    {
      name: "Halbfinale",
      matches: [
        {
          top: createPlaceholderTeam("Sieger VF 1"),
          bottom: createPlaceholderTeam("Sieger VF 2")
        },
        {
          top: createPlaceholderTeam("Sieger VF 3"),
          bottom: createPlaceholderTeam("Sieger VF 4")
        }
      ]
    },
    {
      name: "Finale",
      matches: [
        {
          top: createPlaceholderTeam("Sieger HF 1"),
          bottom: createPlaceholderTeam("Sieger HF 2")
        }
      ]
    }
  ];

  return (
    <main className="tournament-page">
      <section className="tournament-hero">
        <div className="tournament-hero-content">
          <p className="tournament-kicker">Live Bracket</p>
          <h1>Turnierbaum</h1>
          <p>
            Die Gruppenphase ist der erste Schritt Richtung Finale. Die Teams
            mit den meisten Punkten stehen jeweils oben in ihrer Gruppe.
          </p>

          {firebaseError && <p>{firebaseError}</p>}
        </div>
      </section>

      <section className="group-stage-section">
        <div className="tournament-section-header">
          <p className="tournament-kicker">Gruppenphase</p>
          <h2>6 Gruppen · 24 Teams</h2>
          <p>
            Jede Gruppe besteht aus 4 Teams. Die Tabelle sortiert automatisch
            nach Punkten.
          </p>
        </div>

        <div className="groups-grid">
          {sortedGroups.map((group) => (
            <article className="group-card" key={group.name}>
              <div className="group-card-header">
                <h3>{group.name}</h3>
                <span>4 Teams</span>
              </div>

              <div className="group-table">
                <div className="group-table-row group-table-head">
                  <span>Platz</span>
                  <span>Team</span>
                  <span>Punkte</span>
                </div>

                {group.teams.map((team, index) => (
                  <div
                    className={`group-table-row ${
                      index === 0 ? "is-leader" : ""
                    }`}
                    key={`${group.name}-${team.name}`}
                  >
                    <span className="team-rank">{index + 1}</span>
                    <span className="team-name">{team.name}</span>
                    <span className="team-points">{team.points}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bracket-section">
        <div className="tournament-section-header">
          <p className="tournament-kicker">Knockout Phase</p>
          <h2>Der Weg ins Finale</h2>
          <p>
            Für das Viertelfinale qualifizieren sich die 6 Gruppensieger und
            die 2 besten Zweitplatzierten.
          </p>
        </div>

        <div className="bracket-scroll">
          <div className="bracket-board">
            {bracketRounds.map((round) => (
              <div className="bracket-round" key={round.name}>
                <h3>{round.name}</h3>

                <div className="bracket-matches">
                  {round.matches.map((match, index) => (
                    <article
                      className="bracket-match"
                      key={`${round.name}-${index}`}
                    >
                      <p className="match-number">Match {index + 1}</p>

                      <div className="bracket-team">
                        <span>
                          {match.top.seed && <em>{match.top.seed}</em>}
                          {match.top.name}
                        </span>
                        <strong>
                          {hasPoints(match.top)
                            ? `${match.top.points} Pkt.`
                            : "offen"}
                        </strong>
                      </div>

                      <div className="match-divider">vs</div>

                      <div className="bracket-team">
                        <span>
                          {match.bottom.seed && <em>{match.bottom.seed}</em>}
                          {match.bottom.name}
                        </span>
                        <strong>
                          {hasPoints(match.bottom)
                            ? `${match.bottom.points} Pkt.`
                            : "offen"}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default TournamentTree;