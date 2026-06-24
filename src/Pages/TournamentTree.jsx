import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import defaultGroups from "../data/defaultGroups";
import "./TournamentTree.css";

const WIN_POINTS = 3;

function getNumber(value) {
  return Number(value) || 0;
}

function getCupStats(team) {
  const cupsFor = getNumber(team?.cupsFor);
  const cupsAgainst = getNumber(team?.cupsAgainst);
  const cupDifference = cupsFor - cupsAgainst;

  return {
    cupsFor,
    cupsAgainst,
    cupDifference
  };
}

function compareTeams(teamA, teamB) {
  const pointsA = getNumber(teamA.points);
  const pointsB = getNumber(teamB.points);

  if (pointsB !== pointsA) {
    return pointsB - pointsA;
  }

  const cupStatsA = getCupStats(teamA);
  const cupStatsB = getCupStats(teamB);

  if (cupStatsB.cupDifference !== cupStatsA.cupDifference) {
    return cupStatsB.cupDifference - cupStatsA.cupDifference;
  }

  if (cupStatsB.cupsFor !== cupStatsA.cupsFor) {
    return cupStatsB.cupsFor - cupStatsA.cupsFor;
  }

  return teamA.name.localeCompare(teamB.name);
}

function formatCupDifference(cupDifference) {
  if (cupDifference > 0) {
    return `+${cupDifference}`;
  }

  return `${cupDifference}`;
}

function createBracketTeam(team, groupName, placement) {
  if (!team) {
    return createPlaceholderTeam("Offen");
  }

  const groupLetter = groupName.replace("Gruppe ", "");
  const cupStats = getCupStats(team);

  return {
    name: team.name,
    points: getNumber(team.points),
    cupsFor: cupStats.cupsFor,
    cupsAgainst: cupStats.cupsAgainst,
    cupDifference: cupStats.cupDifference,
    seed: `${groupLetter}${placement}`,
    groupName,
    placement
  };
}

function createPlaceholderTeam(name) {
  return {
    name,
    points: null,
    cupsFor: null,
    cupsAgainst: null,
    cupDifference: null,
    seed: "",
    groupName: ""
  };
}

function isSameTeam(teamA, teamB) {
  if (!teamA || !teamB) {
    return false;
  }

  return teamA.name === teamB.name && teamA.groupName === teamB.groupName;
}

function normalizeTeamName(team) {
  if (typeof team === "string") {
    return team;
  }

  return team?.name || "";
}

function getMatchScoreValue(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

function hasCompleteGroupMatchResult(match) {
  return (
    getMatchScoreValue(match?.cupsA) !== null &&
    getMatchScoreValue(match?.cupsB) !== null
  );
}

function createGroupSlug(groupName) {
  return groupName
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function createDefaultGroupMatches(groups) {
  const pairings = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2]
  ];

  return groups.flatMap((group) => {
    const teams = Array.isArray(group.teams) ? group.teams : [];
    const groupSlug = createGroupSlug(group.name);

    return pairings.map(([teamAIndex, teamBIndex], index) => ({
      id: `${groupSlug}-${index + 1}`,
      groupName: group.name,
      matchNumber: index + 1,
      teamA: teams[teamAIndex]?.name || "Offen",
      teamB: teams[teamBIndex]?.name || "Offen",
      cupsA: null,
      cupsB: null,
      isFinished: false
    }));
  });
}

function createGroupSchedule(groups, firebaseGroupMatches) {
  const defaultGroupMatches = createDefaultGroupMatches(groups);

  if (!Array.isArray(firebaseGroupMatches) || firebaseGroupMatches.length === 0) {
    return defaultGroupMatches;
  }

  const firebaseGroupMatchesById = new Map(
    firebaseGroupMatches
      .filter((match) => match && match.id)
      .map((match) => [match.id, match])
  );

  return defaultGroupMatches.map((defaultMatch) => {
    const firebaseMatch = firebaseGroupMatchesById.get(defaultMatch.id);

    if (!firebaseMatch) {
      return defaultMatch;
    }

    const cupsA = getMatchScoreValue(
      firebaseMatch.cupsA ?? firebaseMatch.scoreA ?? firebaseMatch.teamAScore
    );
    const cupsB = getMatchScoreValue(
      firebaseMatch.cupsB ?? firebaseMatch.scoreB ?? firebaseMatch.teamBScore
    );

    return {
      ...defaultMatch,
      ...firebaseMatch,
      id: defaultMatch.id,
      groupName: defaultMatch.groupName,
      matchNumber: defaultMatch.matchNumber,
      teamA: normalizeTeamName(firebaseMatch.teamA) || defaultMatch.teamA,
      teamB: normalizeTeamName(firebaseMatch.teamB) || defaultMatch.teamB,
      cupsA,
      cupsB,
      isFinished:
        Boolean(firebaseMatch.isFinished || firebaseMatch.finished) ||
        (cupsA !== null && cupsB !== null)
    };
  });
}

function calculateGroupsFromGroupMatches(groups, groupMatches) {
  return groups.map((group) => {
    const calculatedTeams = group.teams.map((team) => ({
      ...team,
      points: 0,
      cupsFor: 0,
      cupsAgainst: 0,
      cupDifference: 0
    }));

    const teamsByName = new Map(
      calculatedTeams.map((team) => [team.name, team])
    );

    groupMatches
      .filter((match) => match.groupName === group.name)
      .filter(hasCompleteGroupMatchResult)
      .forEach((match) => {
        const cupsA = getMatchScoreValue(match.cupsA);
        const cupsB = getMatchScoreValue(match.cupsB);
        const teamA = teamsByName.get(normalizeTeamName(match.teamA));
        const teamB = teamsByName.get(normalizeTeamName(match.teamB));

        if (!teamA || !teamB || cupsA === null || cupsB === null) {
          return;
        }

        teamA.cupsFor += cupsA;
        teamA.cupsAgainst += cupsB;
        teamB.cupsFor += cupsB;
        teamB.cupsAgainst += cupsA;

        if (cupsA > cupsB) {
          teamA.points += WIN_POINTS;
        }

        if (cupsB > cupsA) {
          teamB.points += WIN_POINTS;
        }
      });

    return {
      ...group,
      teams: calculatedTeams.map((team) => ({
        ...team,
        cupDifference: getNumber(team.cupsFor) - getNumber(team.cupsAgainst)
      }))
    };
  });
}

function getTeamOrPlaceholder(team, placeholderName) {
  if (!team) {
    return createPlaceholderTeam(placeholderName);
  }

  const cupStats = getCupStats(team);

  return {
    name: team.name,
    points: typeof team.points === "number" ? team.points : getNumber(team.points),
    cupsFor: cupStats.cupsFor,
    cupsAgainst: cupStats.cupsAgainst,
    cupDifference: cupStats.cupDifference,
    seed: team.seed || "",
    groupName: team.groupName || "",
    placement: team.placement || ""
  };
}

function createFallbackBracketRounds(sortedGroups) {
  const groupWinners = sortedGroups.map((group) =>
    createBracketTeam(group.teams[0], group.name, 1)
  );

  const groupSecondPlaces = sortedGroups.map((group) =>
    createBracketTeam(group.teams[1], group.name, 2)
  );

  const bestThirdPlaces = sortedGroups
    .map((group) => createBracketTeam(group.teams[2], group.name, 3))
    .sort(compareTeams)
    .slice(0, 4);

  return [
    {
      name: "Achtelfinale",
      matches: [
        {
          id: "preview-af1",
          top: groupWinners[0] || createPlaceholderTeam("Offen"),
          bottom: bestThirdPlaces[3] || createPlaceholderTeam("Bester 3."),
          winner: null
        },
        {
          id: "preview-af2",
          top: groupWinners[1] || createPlaceholderTeam("Offen"),
          bottom: bestThirdPlaces[2] || createPlaceholderTeam("Bester 3."),
          winner: null
        },
        {
          id: "preview-af3",
          top: groupWinners[2] || createPlaceholderTeam("Offen"),
          bottom: bestThirdPlaces[1] || createPlaceholderTeam("Bester 3."),
          winner: null
        },
        {
          id: "preview-af4",
          top: groupWinners[3] || createPlaceholderTeam("Offen"),
          bottom: bestThirdPlaces[0] || createPlaceholderTeam("Bester 3."),
          winner: null
        },
        {
          id: "preview-af5",
          top: groupWinners[4] || createPlaceholderTeam("Offen"),
          bottom: groupSecondPlaces[5] || createPlaceholderTeam("Zweiter Gruppe"),
          winner: null
        },
        {
          id: "preview-af6",
          top: groupWinners[5] || createPlaceholderTeam("Offen"),
          bottom: groupSecondPlaces[4] || createPlaceholderTeam("Zweiter Gruppe"),
          winner: null
        },
        {
          id: "preview-af7",
          top: groupSecondPlaces[0] || createPlaceholderTeam("Zweiter Gruppe"),
          bottom: groupSecondPlaces[3] || createPlaceholderTeam("Zweiter Gruppe"),
          winner: null
        },
        {
          id: "preview-af8",
          top: groupSecondPlaces[1] || createPlaceholderTeam("Zweiter Gruppe"),
          bottom: groupSecondPlaces[2] || createPlaceholderTeam("Zweiter Gruppe"),
          winner: null
        }
      ]
    },
    {
      name: "Viertelfinale",
      matches: [
        {
          id: "preview-qf1",
          top: createPlaceholderTeam("Sieger AF 1"),
          bottom: createPlaceholderTeam("Sieger AF 2"),
          winner: null
        },
        {
          id: "preview-qf2",
          top: createPlaceholderTeam("Sieger AF 3"),
          bottom: createPlaceholderTeam("Sieger AF 4"),
          winner: null
        },
        {
          id: "preview-qf3",
          top: createPlaceholderTeam("Sieger AF 5"),
          bottom: createPlaceholderTeam("Sieger AF 6"),
          winner: null
        },
        {
          id: "preview-qf4",
          top: createPlaceholderTeam("Sieger AF 7"),
          bottom: createPlaceholderTeam("Sieger AF 8"),
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

function createFirebaseBracketRounds(bracket, fallbackBracketRounds) {
  if (!bracket || !bracket.rounds) {
    return [];
  }

  const firebaseRounds = bracket.rounds.map((round) => ({
    name: round.name,
    matches: round.matches.map((match, index) => ({
      id: match.id || `${round.name}-${index}`,
      top: getTeamOrPlaceholder(match.teamA, "Noch offen"),
      bottom: getTeamOrPlaceholder(match.teamB, "Noch offen"),
      winner: match.winner || null
    }))
  }));

  const hasRoundOfSixteen = firebaseRounds.some(
    (round) => round.name === "Achtelfinale"
  );

  if (hasRoundOfSixteen) {
    return firebaseRounds;
  }

  const fallbackRoundOfSixteen = fallbackBracketRounds.find(
    (round) => round.name === "Achtelfinale"
  );

  if (!fallbackRoundOfSixteen) {
    return firebaseRounds;
  }

  return [fallbackRoundOfSixteen, ...firebaseRounds];
}

function TournamentTree() {
  const [groups, setGroups] = useState(defaultGroups);
  const [firebaseGroupMatches, setFirebaseGroupMatches] = useState([]);
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

          if (Array.isArray(tournamentData.groupMatches)) {
            setFirebaseGroupMatches(tournamentData.groupMatches);
          } else {
            setFirebaseGroupMatches([]);
          }

          if (tournamentData.bracket) {
            setBracket(tournamentData.bracket);
          } else {
            setBracket(null);
          }
        } else {
          setGroups(defaultGroups);
          setFirebaseGroupMatches([]);
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

  const groupSchedule = createGroupSchedule(groups, firebaseGroupMatches);
  const hasPlayedGroupMatches = groupSchedule.some(hasCompleteGroupMatchResult);
  const calculatedGroups = hasPlayedGroupMatches
    ? calculateGroupsFromGroupMatches(groups, groupSchedule)
    : groups;

  const sortedGroups = calculatedGroups.map((group) => ({
    ...group,
    teams: [...group.teams].sort(compareTeams)
  }));

  const fallbackBracketRounds = createFallbackBracketRounds(sortedGroups);
  const firebaseBracketRounds = createFirebaseBracketRounds(
    bracket,
    fallbackBracketRounds
  );

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
            nach Punkten, Becherverhältnis und getroffenen Bechern.
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
                  <span>Becher</span>
                  <span>+/-</span>
                </div>

                {group.teams.map((team, index) => {
                  const cupStats = getCupStats(team);

                  return (
                    <div
                      className={`group-table-row ${
                        index === 0 ? "is-leader" : ""
                      }`}
                      key={`${group.name}-${team.name}`}
                    >
                      <span className="team-rank">{index + 1}</span>
                      <span className="team-name">{team.name}</span>
                      <span className="team-points">{getNumber(team.points)}</span>
                      <span className="team-cups">
                        {cupStats.cupsFor}:{cupStats.cupsAgainst}
                      </span>
                      <span className="team-cup-difference">
                        {formatCupDifference(cupStats.cupDifference)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="group-schedule-section">
        <div className="tournament-section-header">
          <p className="tournament-kicker">Gruppenspiele</p>
          <h2>Spielplan der Gruppenphase</h2>
          <p>
            Sobald der Host ein Ergebnis speichert, werden Punkte,
            Becherverhältnis und getroffene Becher automatisch neu berechnet.
          </p>
        </div>

        <div className="group-schedule-grid">
          {calculatedGroups.map((group) => {
            const matchesForGroup = groupSchedule.filter(
              (match) => match.groupName === group.name
            );
            const playedMatches = matchesForGroup.filter(
              hasCompleteGroupMatchResult
            ).length;

            return (
              <article className="group-schedule-card" key={group.name}>
                <div className="group-card-header">
                  <h3>{group.name}</h3>
                  <span>
                    {playedMatches}/{matchesForGroup.length} gespielt
                  </span>
                </div>

                <div className="group-schedule-list">
                  {matchesForGroup.map((match) => {
                    const cupsA = getMatchScoreValue(match.cupsA);
                    const cupsB = getMatchScoreValue(match.cupsB);
                    const hasResult = cupsA !== null && cupsB !== null;
                    const teamAWins = hasResult && cupsA > cupsB;
                    const teamBWins = hasResult && cupsB > cupsA;

                    return (
                      <div
                        className={`group-schedule-match ${
                          hasResult ? "is-played" : ""
                        }`}
                        key={match.id}
                      >
                        <span className="schedule-match-number">
                          Spiel {match.matchNumber}
                        </span>

                        <span
                          className={`schedule-team ${
                            teamAWins ? "is-winner" : ""
                          }`}
                        >
                          {match.teamA}
                        </span>

                        <strong className="schedule-result">
                          {hasResult ? `${cupsA}:${cupsB}` : "offen"}
                        </strong>

                        <span
                          className={`schedule-team ${
                            teamBWins ? "is-winner" : ""
                          }`}
                        >
                          {match.teamB}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
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
