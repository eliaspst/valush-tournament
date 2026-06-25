import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import defaultGroups from "../data/defaultGroups";
import "./TournamentTree.css";

const WIN_POINTS = 3;

const FIXED_GROUP_MATCH_SCHEDULES = [
  [
    ["Zapf-Zombies", "Assozial statt National"],
    ["Drink or get Drunk", "Lifeguards"],
    ["Zapf-Zombies", "Drink or get Drunk"],
    ["Assozial statt National", "Lifeguards"],
    ["Zapf-Zombies", "Lifeguards"],
    ["Assozial statt National", "Zapf-Zombies"]
  ],
  [
    ["Bierschutzbeauftragte", "Warnstufe Claudimona"],
    ["Mallorca Allstars", "Luchos"],
    ["Bierschutzbeauftragte", "Mallorca Allstars"],
    ["Warnstufe Claudimona", "Luchos"],
    ["Bierschutzbeauftragte", "Luchos"],
    ["Warnstufe Claudimona", "Mallorca Allstars"]
  ],
  [
    ["Bieraten", "Paulao Brauer"],
    ["Promille Polizei", "Beachclub United"],
    ["Bieraten", "Beachclub United"],
    ["Paulao Brauer", "Beachclub United"],
    ["Bieraten", "Promille Polizei"],
    ["Paulao Brauer", "Promille Polizei"]
  ],
  [
    ["Team Captain", "Die Unteraicher Jungs"],
    ["Team Big Balls", "Team Sonne"],
    ["Team Captain", "Team Big Balls"],
    ["Die Unteraicher Jungs", "Team Sonne"],
    ["Team Captain", "Team Sonne"],
    ["Die Unteraicher Jungs", "Team Big Balls"]
  ],
  [
    ["Palmen aus Plastik", "Bierus Maximus"],
    ["Pamela Andersonne", "K(akh)is"],
    ["Palmen aus Plastik", "K(akh)is"],
    ["Pamela Andersonne", "Bierus Maximus"],
    ["Bierus Maximus", "K(akh)is"],
    ["Pamela Andersonne", "Palmen aus Plastik"]
  ],
  [
    ["Safari Babes", "Chrissi trifft, Mattis singt"],
    ["Pierre du lolly", "Beer Bowl Champions"],
    ["Safari Babes", "Pierre du lolly"],
    ["Chrissi trifft, Mattis singt", "Beer Bowl Champions"],
    ["Safari Babes", "Beer Bowl Champions"],
    ["Chrissi trifft, Mattis singt", "Pierre du lolly"]
  ]
];


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

function createBracketTeam(team, groupName, placement, groupNumber) {
  if (!team) {
    return createPlaceholderTeam("Offen");
  }

  const cupStats = getCupStats(team);
  const seed = groupNumber ? `G${groupNumber}-${placement}` : `${groupName}-${placement}`;

  return {
    name: team.name,
    points: getNumber(team.points),
    cupsFor: cupStats.cupsFor,
    cupsAgainst: cupStats.cupsAgainst,
    cupDifference: cupStats.cupDifference,
    seed,
    groupName,
    placement
  };
}

function createPlaceholderTeam(name, seed = "") {
  return {
    name,
    points: null,
    cupsFor: null,
    cupsAgainst: null,
    cupDifference: null,
    seed,
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

function normalizeScheduleTeamName(teamName) {
  return normalizeTeamName(teamName)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

function getScheduledTeamName(teams, scheduledTeamName) {
  const foundTeam = teams.find(
    (team) =>
      normalizeScheduleTeamName(team?.name) ===
      normalizeScheduleTeamName(scheduledTeamName)
  );

  return foundTeam?.name || scheduledTeamName || "Offen";
}

function countMatchingScheduledTeams(schedule, teams) {
  const teamNames = new Set(
    teams.map((team) => normalizeScheduleTeamName(team?.name))
  );
  const scheduledTeamNames = new Set(
    schedule.flat().map((teamName) => normalizeScheduleTeamName(teamName))
  );

  return [...scheduledTeamNames].filter((teamName) => teamNames.has(teamName))
    .length;
}

function getFixedGroupSchedule(group, groupIndex) {
  const teams = Array.isArray(group.teams) ? group.teams : [];
  const exactSchedule = FIXED_GROUP_MATCH_SCHEDULES.find(
    (schedule) => countMatchingScheduledTeams(schedule, teams) === 4
  );

  return exactSchedule || FIXED_GROUP_MATCH_SCHEDULES[groupIndex] || null;
}

function createFallbackGroupSchedule(teams) {
  const pairings = [
    [0, 1],
    [2, 3],
    [0, 2],
    [1, 3],
    [0, 3],
    [1, 2]
  ];

  return pairings.map(([teamAIndex, teamBIndex]) => [
    teams[teamAIndex]?.name || "Offen",
    teams[teamBIndex]?.name || "Offen"
  ]);
}

function createDefaultGroupMatches(groups) {
  return groups.flatMap((group, groupIndex) => {
    const teams = Array.isArray(group.teams) ? group.teams : [];
    const groupSlug = createGroupSlug(group.name);
    const fixedSchedule = getFixedGroupSchedule(group, groupIndex);
    const groupSchedule = fixedSchedule || createFallbackGroupSchedule(teams);

    return groupSchedule.map(([teamAName, teamBName], index) => ({
      id: `group-${groupIndex + 1}-match-${index + 1}`,
      legacyId: `${groupSlug}-${index + 1}`,
      groupIndex,
      groupName: group.name,
      matchNumber: index + 1,
      teamA: getScheduledTeamName(teams, teamAName),
      teamB: getScheduledTeamName(teams, teamBName),
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

  const safeFirebaseGroupMatches = firebaseGroupMatches.filter(Boolean);
  const firebaseGroupMatchesById = new Map(
    safeFirebaseGroupMatches
      .filter((match) => match.id)
      .map((match) => [match.id, match])
  );

  function findFirebaseMatch(defaultMatch) {
    return (
      firebaseGroupMatchesById.get(defaultMatch.id) ||
      firebaseGroupMatchesById.get(defaultMatch.legacyId) ||
      safeFirebaseGroupMatches.find(
        (match) =>
          match.groupIndex === defaultMatch.groupIndex &&
          match.matchNumber === defaultMatch.matchNumber
      ) ||
      safeFirebaseGroupMatches.find(
        (match) =>
          match.groupName === defaultMatch.groupName &&
          match.matchNumber === defaultMatch.matchNumber
      ) ||
      null
    );
  }

  return defaultGroupMatches.map((defaultMatch) => {
    const firebaseMatch = findFirebaseMatch(defaultMatch);

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
      id: defaultMatch.id,
      legacyId: defaultMatch.legacyId,
      groupIndex: defaultMatch.groupIndex,
      groupName: defaultMatch.groupName,
      matchNumber: defaultMatch.matchNumber,
      teamA: defaultMatch.teamA,
      teamB: defaultMatch.teamB,
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
      calculatedTeams.map((team) => [normalizeScheduleTeamName(team.name), team])
    );

    groupMatches
      .filter((match) => match.groupName === group.name)
      .filter(hasCompleteGroupMatchResult)
      .forEach((match) => {
        const cupsA = getMatchScoreValue(match.cupsA);
        const cupsB = getMatchScoreValue(match.cupsB);
        const teamA = teamsByName.get(
          normalizeScheduleTeamName(normalizeTeamName(match.teamA))
        );
        const teamB = teamsByName.get(
          normalizeScheduleTeamName(normalizeTeamName(match.teamB))
        );

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

function createBestThirdPlaces(sortedGroups) {
  return sortedGroups
    .map((group) =>
      createBracketTeam(group.teams[2], group.name, 3, group.groupNumber)
    )
    .sort(compareTeams)
    .slice(0, 4)
    .map((team, index) => ({
      ...team,
      originalSeed: team.seed,
      seed: `BD${index + 1}`,
      bestThirdRank: index + 1
    }));
}

function createFallbackBracketRounds(sortedGroups) {
  const groupWinners = sortedGroups.map((group) =>
    createBracketTeam(group.teams[0], group.name, 1, group.groupNumber)
  );

  const groupSecondPlaces = sortedGroups.map((group) =>
    createBracketTeam(group.teams[1], group.name, 2, group.groupNumber)
  );

  const bestThirdPlaces = createBestThirdPlaces(sortedGroups);

  return [
    {
      name: "Achtelfinale",
      matches: [
        {
          id: "preview-af1",
          top: groupWinners[0] || createPlaceholderTeam("G1-1", "G1-1"),
          bottom: bestThirdPlaces[3] || createPlaceholderTeam("BD4", "BD4"),
          winner: null
        },
        {
          id: "preview-af2",
          top: groupSecondPlaces[3] || createPlaceholderTeam("G4-2", "G4-2"),
          bottom: groupSecondPlaces[4] || createPlaceholderTeam("G5-2", "G5-2"),
          winner: null
        },
        {
          id: "preview-af3",
          top: groupWinners[2] || createPlaceholderTeam("G3-1", "G3-1"),
          bottom: groupSecondPlaces[5] || createPlaceholderTeam("G6-2", "G6-2"),
          winner: null
        },
        {
          id: "preview-af4",
          top: groupSecondPlaces[1] || createPlaceholderTeam("G2-2", "G2-2"),
          bottom: bestThirdPlaces[1] || createPlaceholderTeam("BD2", "BD2"),
          winner: null
        },
        {
          id: "preview-af5",
          top: groupWinners[1] || createPlaceholderTeam("G2-1", "G2-1"),
          bottom: bestThirdPlaces[2] || createPlaceholderTeam("BD3", "BD3"),
          winner: null
        },
        {
          id: "preview-af6",
          top: groupSecondPlaces[2] || createPlaceholderTeam("G3-2", "G3-2"),
          bottom: groupWinners[3] || createPlaceholderTeam("G4-1", "G4-1"),
          winner: null
        },
        {
          id: "preview-af7",
          top: groupWinners[4] || createPlaceholderTeam("G5-1", "G5-1"),
          bottom: groupSecondPlaces[0] || createPlaceholderTeam("G1-2", "G1-2"),
          winner: null
        },
        {
          id: "preview-af8",
          top: groupWinners[5] || createPlaceholderTeam("G6-1", "G6-1"),
          bottom: bestThirdPlaces[0] || createPlaceholderTeam("BD1", "BD1"),
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

function mergeFirebaseRoundWithFallback(firebaseRound, fallbackRound) {
  if (!fallbackRound) {
    return firebaseRound;
  }

  return {
    name: fallbackRound.name,
    matches: fallbackRound.matches.map((fallbackMatch, index) => {
      const firebaseMatch = firebaseRound.matches[index];

      if (!firebaseMatch) {
        return fallbackMatch;
      }

      return {
        ...fallbackMatch,
        id: firebaseMatch.id || fallbackMatch.id,
        winner: firebaseMatch.winner || fallbackMatch.winner || null
      };
    })
  };
}

function createFirebaseBracketRounds(bracket, fallbackBracketRounds) {
  if (!bracket || !bracket.rounds) {
    return [];
  }

  const fallbackRoundsByName = new Map(
    fallbackBracketRounds.map((round) => [round.name, round])
  );

  const firebaseRounds = bracket.rounds.map((round) => {
    const fallbackRound = fallbackRoundsByName.get(round.name);

    if (round.name === "Achtelfinale") {
      return mergeFirebaseRoundWithFallback(round, fallbackRound);
    }

    return {
      name: round.name,
      matches: round.matches.map((match, index) => ({
        id: match.id || `${round.name}-${index}`,
        top: getTeamOrPlaceholder(match.teamA, "Noch offen"),
        bottom: getTeamOrPlaceholder(match.teamB, "Noch offen"),
        winner: match.winner || null
      }))
    };
  });

  const hasRoundOfSixteen = firebaseRounds.some(
    (round) => round.name === "Achtelfinale"
  );

  if (hasRoundOfSixteen) {
    return firebaseRounds;
  }

  const fallbackRoundOfSixteen = fallbackRoundsByName.get("Achtelfinale");

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

  const sortedGroups = calculatedGroups.map((group, index) => ({
    ...group,
    groupNumber: index + 1,
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
            Jede Gruppe besteht aus 4 Teams. Die Tabelle sortiert
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
