import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import defaultGroups from "../data/defaultGroups";
import "./TournamentTree.css";

function createBracketTeam(team, groupName, placement) {
  if (!team) {
    return createPlaceholderTeam("Offen");
  }

  return {
    name: team.name,
    points: Number(team.points) || 0,
    seed: placement === 1 ? "1." : "2.",
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
  return team && typeof team.points === "number";
}

function isSameTeam(teamA, teamB) {
  if (!teamA || !teamB) {
    return false;
  }

  return teamA.name === teamB.name && teamA.groupName === teamB.groupName;
}

function getTeamOrPlaceholder(team, placeholderName) {
  if (!team) {
    return createPlaceholderTeam(placeholderName);
  }

  return {
    name: team.name,
    points: typeof team.points === "number" ? team.points : null,
    seed: team.seed || "",
    groupName: team.groupName || "",
    placement: team.placement || ""
  };
}

function createFallbackBracketRounds(sortedGroups) {
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

  return [
    {
      name: "Viertelfinale",
      matches: [
        {
          id: "preview-qf1",
          top: groupWinners[0] || createPlaceholderTeam("Offen"),
          bottom: bestSecondPlaces[0] || createPlaceholderTeam("Offen"),
          winner: null
        },
        {
          id: "preview-qf2",
          top: groupWinners[1] || createPlaceholderTeam("Offen"),
          bottom: bestSecondPlaces[1] || createPlaceholderTeam("Offen"),
          winner: null
        },
        {
          id: "preview-qf3",
          top: groupWinners[2] || createPlaceholderTeam("Offen"),
          bottom: groupWinners[5] || createPlaceholderTeam("Offen"),
          winner: null
        },
        {
          id: "preview-qf4",
          top: groupWinners[3] || createPlaceholderTeam("Offen"),
          bottom: groupWinners[4] || createPlaceholderTeam("Offen"),
          winner: null
        }
      ]
    },
    {
      name: "Halbfinale",
      matches: [
        {
          id: "preview-sf1",
          top: createPlaceholderTeam("Sieger VF 1"),
          bottom: createPlaceholderTeam("Sieger VF 2"),
          winner: null
        },
        {
          id: "preview-sf2",
          top: createPlaceholderTeam("Sieger VF 3"),
          bottom: createPlaceholderTeam("Sieger VF 4"),
          winner: null
        }
      ]
    },
    {
      name: "Finale",
      matches: [
        {
          id: "preview-final",
          top: createPlaceholderTeam("Sieger HF 1"),
          bottom: createPlaceholderTeam("Sieger HF 2"),
          winner: null
        }
      ]
    }
  ];
}

function createFirebaseBracketRounds(bracket) {
  if (!bracket || !bracket.rounds) {
    return [];
  }

  return bracket.rounds.map((round) => ({
    name: round.name,
    matches: round.matches.map((match, index) => ({
      id: match.id || `${round.name}-${index}`,
      top: getTeamOrPlaceholder(match.teamA, "Noch offen"),
      bottom: getTeamOrPlaceholder(match.teamB, "Noch offen"),
      winner: match.winner || null
    }))
  }));
}

function TournamentTree() {
  const [groups, setGroups] = useState(defaultGroups);
  const [bracket, setBracket] = useState(null);
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
          } else {
            setGroups(defaultGroups);
          }

          if (tournamentData.bracket) {
            setBracket(tournamentData.bracket);
          } else {
            setBracket(null);
          }
        } else {
          setGroups(defaultGroups);
          setBracket(null);
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
      const pointsA = Number(teamA.points) || 0;
      const pointsB = Number(teamB.points) || 0;

      if (pointsB !== pointsA) {
        return pointsB - pointsA;
      }

      return teamA.name.localeCompare(teamB.name);
    })
  }));

  const fallbackBracketRounds = createFallbackBracketRounds(sortedGroups);
  const firebaseBracketRounds = createFirebaseBracketRounds(bracket);

  const hasGeneratedBracket = firebaseBracketRounds.length > 0;
  const bracketRounds = hasGeneratedBracket
    ? firebaseBracketRounds
    : fallbackBracketRounds;

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

        </div>

        {bracket?.champion && (
          <div className="tournament-champion-card">
            <p>Turniersieger</p>
            <h2>{bracket.champion.name}</h2>
          </div>
        )}

        <div className="bracket-scroll">
          <div className="bracket-board">
            {bracketRounds.map((round) => (
              <div className="bracket-round" key={round.name}>
                <h3>{round.name}</h3>

                <div className="bracket-matches">
                  {round.matches.map((match, index) => (
                    <article
                      className="bracket-match"
                      key={`${round.name}-${match.id}-${index}`}
                    >
                      <p className="match-number">Match {index + 1}</p>

                      <div
                        className={`bracket-team ${
                          isSameTeam(match.winner, match.top)
                            ? "is-winner"
                            : ""
                        }`}
                      >
                        <span>
                          {match.top.seed && <em>{match.top.seed}</em>}
                          {match.top.name}
                        </span>

                        <strong>
                          {hasPoints(match.top)
                            ? `${match.top.points} Pkt.`
                            : "offen"}
                        </strong>

                        {isSameTeam(match.winner, match.top) && (
                          <small className="bracket-winner-badge">
                            Gewinner
                          </small>
                        )}
                      </div>

                      <div className="match-divider">vs</div>

                      <div
                        className={`bracket-team ${
                          isSameTeam(match.winner, match.bottom)
                            ? "is-winner"
                            : ""
                        }`}
                      >
                        <span>
                          {match.bottom.seed && <em>{match.bottom.seed}</em>}
                          {match.bottom.name}
                        </span>

                        <strong>
                          {hasPoints(match.bottom)
                            ? `${match.bottom.points} Pkt.`
                            : "offen"}
                        </strong>

                        {isSameTeam(match.winner, match.bottom) && (
                          <small className="bracket-winner-badge">
                            Gewinner
                          </small>
                        )}
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