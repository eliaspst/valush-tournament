import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";
import { auth, db } from "../firebase";
import defaultGroups from "../data/defaultGroups";
import "./HostPanel.css";

const WIN_POINTS = 3;

const FIXED_GROUP_MATCH_SCHEDULES = [
  [
    ["Zapf-Zombies", "Assozial statt National"],
    ["Drink or get Drunk", "Lifeguards"],
    ["Zapf-Zombies", "Drink or get Drunk"],
    ["Assozial statt National", "Lifeguards"],
    ["Zapf-Zombies", "Lifeguards"],
    ["Assozial statt National", "Drink or get Drunk"]
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
    ["Bierbauerbeiter", "Beer Bowl Champions"],
    ["Safari Babes", "Bierbauerbeiter"],
    ["Chrissi trifft, Mattis singt", "Beer Bowl Champions"],
    ["Safari Babes", "Beer Bowl Champions"],
    ["Chrissi trifft, Mattis singt", "Bierbauerbeiter"]
  ]
];

const winnerRoutes = {
  af1: { roundIndex: 1, matchIndex: 0, slot: "teamA" },
  af2: { roundIndex: 1, matchIndex: 0, slot: "teamB" },
  af3: { roundIndex: 1, matchIndex: 1, slot: "teamA" },
  af4: { roundIndex: 1, matchIndex: 1, slot: "teamB" },
  af5: { roundIndex: 1, matchIndex: 2, slot: "teamA" },
  af6: { roundIndex: 1, matchIndex: 2, slot: "teamB" },
  af7: { roundIndex: 1, matchIndex: 3, slot: "teamA" },
  af8: { roundIndex: 1, matchIndex: 3, slot: "teamB" },
  qf1: { roundIndex: 2, matchIndex: 0, slot: "teamA" },
  qf2: { roundIndex: 2, matchIndex: 0, slot: "teamB" },
  qf3: { roundIndex: 2, matchIndex: 1, slot: "teamA" },
  qf4: { roundIndex: 2, matchIndex: 1, slot: "teamB" },
  sf1: { roundIndex: 3, matchIndex: 0, slot: "teamA" },
  sf2: { roundIndex: 3, matchIndex: 0, slot: "teamB" }
};

function getNumber(value) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return parsedValue;
}

function isFilledNumber(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
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

function formatCupDifference(cupDifference) {
  if (cupDifference > 0) {
    return `+${cupDifference}`;
  }

  return `${cupDifference}`;
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

function getCleanCupValue(value) {
  if (!isFilledNumber(value)) {
    return "";
  }

  return Number(value);
}

function normalizeScheduleTeamName(teamName) {
  return String(teamName || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isScheduledTeamNameMatch(teamName, scheduledTeamName) {
  const normalizedTeamName = normalizeScheduleTeamName(teamName);
  const normalizedScheduledTeamName = normalizeScheduleTeamName(scheduledTeamName);
  const normalizedTeamNameWithoutInfo = normalizeScheduleTeamName(
    String(teamName || "").replace(/\([^)]*\)/g, "")
  );
  const normalizedScheduledTeamNameWithoutInfo = normalizeScheduleTeamName(
    String(scheduledTeamName || "").replace(/\([^)]*\)/g, "")
  );

  return (
    normalizedTeamName === normalizedScheduledTeamName ||
    normalizedTeamNameWithoutInfo === normalizedScheduledTeamName ||
    normalizedTeamName === normalizedScheduledTeamNameWithoutInfo ||
    normalizedTeamNameWithoutInfo === normalizedScheduledTeamNameWithoutInfo
  );
}

function findTeamIndexByName(teams, teamName) {
  return (teams || []).findIndex((team) =>
    isScheduledTeamNameMatch(team?.name, teamName)
  );
}

function getScheduledTeam(teams, scheduledTeamName, fallbackIndex) {
  const foundIndex = findTeamIndexByName(teams, scheduledTeamName);

  if (foundIndex >= 0) {
    return {
      index: foundIndex,
      name: teams[foundIndex]?.name || scheduledTeamName
    };
  }

  return {
    index: fallbackIndex,
    name: teams?.[fallbackIndex]?.name || scheduledTeamName || `Team ${fallbackIndex + 1}`
  };
}

function countMatchingScheduledTeams(schedule, teams) {
  return schedule
    .flat()
    .filter((teamName, index, allTeamNames) => allTeamNames.indexOf(teamName) === index)
    .filter((scheduledTeamName) =>
      (teams || []).some((team) =>
        isScheduledTeamNameMatch(team?.name, scheduledTeamName)
      )
    ).length;
}

function getFixedGroupSchedule(group, groupIndex) {
  const teams = Array.isArray(group?.teams) ? group.teams : [];
  const exactSchedule = FIXED_GROUP_MATCH_SCHEDULES.find(
    (schedule) => countMatchingScheduledTeams(schedule, teams) === 4
  );

  return exactSchedule || FIXED_GROUP_MATCH_SCHEDULES[groupIndex] || null;
}

function getFallbackTeamIndex(groupIndex, scheduledTeamName, fallbackIndex) {
  const defaultGroup = defaultGroups[groupIndex];
  const defaultTeams = Array.isArray(defaultGroup?.teams) ? defaultGroup.teams : [];
  const defaultTeamIndex = findTeamIndexByName(defaultTeams, scheduledTeamName);

  if (defaultTeamIndex >= 0) {
    return defaultTeamIndex;
  }

  return fallbackIndex;
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
    teams?.[teamAIndex]?.name || `Team ${teamAIndex + 1}`,
    teams?.[teamBIndex]?.name || `Team ${teamBIndex + 1}`
  ]);
}

function createGroupSlug(groupName) {
  return String(groupName || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function getExistingMatchForSlot(existingMatchesById, existingMatches, group, groupIndex, matchIndex) {
  const id = `group-${groupIndex + 1}-match-${matchIndex + 1}`;
  const legacyId = `${createGroupSlug(group.name)}-${matchIndex + 1}`;

  return (
    existingMatchesById.get(id) ||
    existingMatchesById.get(legacyId) ||
    existingMatches.find(
      (match) =>
        match?.groupIndex === groupIndex &&
        match?.matchNumber === matchIndex + 1
    ) ||
    existingMatches.find(
      (match) =>
        match?.groupName === group.name &&
        match?.matchNumber === matchIndex + 1
    ) ||
    null
  );
}

function createGroupMatchesFromGroups(groups, existingMatches = []) {
  const safeExistingMatches = Array.isArray(existingMatches) ? existingMatches : [];
  const existingMatchesById = new Map(
    safeExistingMatches
      .filter((match) => match && match.id)
      .map((match) => [match.id, match])
  );

  return groups.flatMap((group, groupIndex) => {
    const teams = Array.isArray(group.teams) ? group.teams : [];
    const fixedSchedule = getFixedGroupSchedule(group, groupIndex);
    const groupSchedule = fixedSchedule || createFallbackGroupSchedule(teams);

    return groupSchedule.map(([scheduledTeamA, scheduledTeamB], matchIndex) => {
      const id = `group-${groupIndex + 1}-match-${matchIndex + 1}`;
      const legacyId = `${createGroupSlug(group.name)}-${matchIndex + 1}`;
      const existingMatch = getExistingMatchForSlot(
        existingMatchesById,
        safeExistingMatches,
        group,
        groupIndex,
        matchIndex
      );
      const scheduledTeamAData = getScheduledTeam(
        teams,
        scheduledTeamA,
        getFallbackTeamIndex(groupIndex, scheduledTeamA, 0)
      );
      const scheduledTeamBData = getScheduledTeam(
        teams,
        scheduledTeamB,
        getFallbackTeamIndex(groupIndex, scheduledTeamB, 1)
      );
      const cupsA = getCleanCupValue(existingMatch?.cupsA);
      const cupsB = getCleanCupValue(existingMatch?.cupsB);
      const isFinished =
        Boolean(existingMatch?.isFinished || existingMatch?.finished) &&
        isFilledNumber(cupsA) &&
        isFilledNumber(cupsB);

      return {
        id,
        legacyId,
        groupIndex,
        groupName: group.name,
        matchNumber: matchIndex + 1,
        teamAIndex: scheduledTeamAData.index,
        teamBIndex: scheduledTeamBData.index,
        teamA: scheduledTeamAData.name,
        teamB: scheduledTeamBData.name,
        cupsA,
        cupsB,
        isFinished
      };
    });
  });
}

function buildDraftMatchResults(matches) {
  return matches.reduce((draftResults, match) => {
    draftResults[match.id] = {
      cupsA: isFilledNumber(match.cupsA) ? String(match.cupsA) : "",
      cupsB: isFilledNumber(match.cupsB) ? String(match.cupsB) : ""
    };

    return draftResults;
  }, {});
}

function mergeDraftMatchResults(matches, currentDraftResults) {
  return matches.reduce((draftResults, match) => {
    const currentDraft = currentDraftResults?.[match.id];

    draftResults[match.id] = {
      cupsA:
        currentDraft?.cupsA !== undefined
          ? currentDraft.cupsA
          : isFilledNumber(match.cupsA)
            ? String(match.cupsA)
            : "",
      cupsB:
        currentDraft?.cupsB !== undefined
          ? currentDraft.cupsB
          : isFilledNumber(match.cupsB)
            ? String(match.cupsB)
            : ""
    };

    return draftResults;
  }, {});
}

function calculateGroupsFromMatches(baseGroups, groupMatches) {
  const recalculatedGroups = baseGroups.map((group) => ({
    ...group,
    teams: (group.teams || []).map((team) => ({
      ...team,
      points: 0,
      cupsFor: 0,
      cupsAgainst: 0,
      cupDifference: 0
    }))
  }));

  groupMatches.forEach((match) => {
    if (!match.isFinished || !isFilledNumber(match.cupsA) || !isFilledNumber(match.cupsB)) {
      return;
    }

    const groupIndex =
      typeof match.groupIndex === "number"
        ? match.groupIndex
        : recalculatedGroups.findIndex((group) => group.name === match.groupName);

    const group = recalculatedGroups[groupIndex];

    if (!group) {
      return;
    }

    const savedTeamAIndex =
      typeof match.teamAIndex === "number" ? match.teamAIndex : -1;
    const savedTeamBIndex =
      typeof match.teamBIndex === "number" ? match.teamBIndex : -1;

    const teamAIndex =
      group.teams[savedTeamAIndex] &&
      normalizeScheduleTeamName(group.teams[savedTeamAIndex].name) ===
        normalizeScheduleTeamName(match.teamA)
        ? savedTeamAIndex
        : findTeamIndexByName(group.teams, match.teamA);

    const teamBIndex =
      group.teams[savedTeamBIndex] &&
      normalizeScheduleTeamName(group.teams[savedTeamBIndex].name) ===
        normalizeScheduleTeamName(match.teamB)
        ? savedTeamBIndex
        : findTeamIndexByName(group.teams, match.teamB);

    const teamA = group.teams[teamAIndex];
    const teamB = group.teams[teamBIndex];

    if (!teamA || !teamB) {
      return;
    }

    const cupsA = Number(match.cupsA);
    const cupsB = Number(match.cupsB);

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

  return recalculatedGroups.map((group) => ({
    ...group,
    teams: group.teams.map((team) => ({
      ...team,
      cupDifference: getNumber(team.cupsFor) - getNumber(team.cupsAgainst)
    }))
  }));
}

function validateCupResult(cupsA, cupsB) {
  if (!isFilledNumber(cupsA) || !isFilledNumber(cupsB)) {
    return "Trage bitte beide Becherzahlen ein.";
  }

  const numberA = Number(cupsA);
  const numberB = Number(cupsB);

  if (numberA < 0 || numberB < 0 || numberA > 6 || numberB > 6) {
    return "Die Becherzahl muss zwischen 0 und 6 liegen.";
  }

  if (numberA === numberB) {
    return "Unentschieden sind in den Gruppenspielen nicht erlaubt.";
  }

  return "";
}

function HostPanel() {
  const [groups, setGroups] = useState(defaultGroups);
  const [groupMatches, setGroupMatches] = useState(() =>
    createGroupMatchesFromGroups(defaultGroups)
  );
  const [draftMatchResults, setDraftMatchResults] = useState(() =>
    buildDraftMatchResults(createGroupMatchesFromGroups(defaultGroups))
  );
  const [bracket, setBracket] = useState(null);
  const [hostUser, setHostUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginError, setLoginError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [firebaseError, setFirebaseError] = useState("");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setHostUser(currentUser);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const tournamentRef = doc(db, "tournaments", "current");

    const unsubscribeTournament = onSnapshot(
      tournamentRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const tournamentData = snapshot.data();
          const firebaseGroups = tournamentData.groups || defaultGroups;
          const firebaseGroupMatches = createGroupMatchesFromGroups(
            firebaseGroups,
            tournamentData.groupMatches || []
          );

          setGroups(firebaseGroups);
          setGroupMatches(firebaseGroupMatches);
          setDraftMatchResults(buildDraftMatchResults(firebaseGroupMatches));

          if (tournamentData.bracket) {
            setBracket(tournamentData.bracket);
          } else {
            setBracket(null);
          }
        } else {
          const freshGroupMatches = createGroupMatchesFromGroups(defaultGroups);

          setGroups(defaultGroups);
          setGroupMatches(freshGroupMatches);
          setDraftMatchResults(buildDraftMatchResults(freshGroupMatches));
          setBracket(null);
        }

        setIsLoading(false);
      },
      () => {
        setFirebaseError("Firebase-Daten konnten nicht geladen werden.");
        setIsLoading(false);
      }
    );

    return () => unsubscribeTournament();
  }, []);

  async function handleLogin(event) {
    event.preventDefault();

    try {
      setLoginError("");
      await signInWithEmailAndPassword(auth, email, password);
      setEmail("");
      setPassword("");
    } catch (error) {
      console.log("Firebase Login Error:", error.code, error.message);

      if (error.code === "auth/invalid-credential") {
        setLoginError("E-Mail oder Passwort ist falsch.");
        return;
      }

      if (error.code === "auth/user-not-found") {
        setLoginError("Dieser User existiert nicht in Firebase Authentication.");
        return;
      }

      if (error.code === "auth/wrong-password") {
        setLoginError("Das Passwort ist falsch.");
        return;
      }

      if (error.code === "auth/operation-not-allowed") {
        setLoginError("Email/Password Login ist in Firebase nicht aktiviert.");
        return;
      }

      if (error.code === "auth/api-key-not-valid") {
        setLoginError("Firebase-Konfiguration ist falsch. Prüfe deine firebase.js.");
        return;
      }

      setLoginError(`Login fehlgeschlagen: ${error.code}`);
    }
  }

  async function handleLogout() {
    await signOut(auth);
  }

  function handleTeamNameChange(groupIndex, teamIndex, newName) {
    const updatedGroups = groups.map((group, currentGroupIndex) => {
      if (currentGroupIndex !== groupIndex) {
        return group;
      }

      return {
        ...group,
        teams: group.teams.map((team, currentTeamIndex) => {
          if (currentTeamIndex !== teamIndex) {
            return team;
          }

          return {
            ...team,
            name: newName
          };
        })
      };
    });

    const updatedGroupMatches = createGroupMatchesFromGroups(
      updatedGroups,
      groupMatches
    );

    setGroups(updatedGroups);
    setGroupMatches(updatedGroupMatches);
    setDraftMatchResults((currentDraftResults) =>
      mergeDraftMatchResults(updatedGroupMatches, currentDraftResults)
    );
    setSaveMessage("");
  }

  function handleGroupMatchResultChange(matchId, fieldName, newValue) {
    setDraftMatchResults((currentDraftResults) => ({
      ...currentDraftResults,
      [matchId]: {
        ...currentDraftResults[matchId],
        [fieldName]: newValue
      }
    }));

    setSaveMessage("");
    setFirebaseError("");
  }

  async function saveGroupMatchesToFirebase(updatedGroups, updatedGroupMatches, message) {
    const tournamentRef = doc(db, "tournaments", "current");

    await setDoc(
      tournamentRef,
      {
        groups: updatedGroups,
        groupMatches: updatedGroupMatches,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    setGroups(updatedGroups);
    setGroupMatches(updatedGroupMatches);
    setDraftMatchResults(buildDraftMatchResults(updatedGroupMatches));
    setSaveMessage(message);
    setFirebaseError("");
  }

  async function handleSaveGroupMatch(matchId) {
    try {
      const matchToSave = groupMatches.find((match) => match.id === matchId);
      const draftResult = draftMatchResults[matchId];

      if (!matchToSave || !draftResult) {
        return;
      }

      const validationError = validateCupResult(
        draftResult.cupsA,
        draftResult.cupsB
      );

      if (validationError) {
        setFirebaseError(validationError);
        return;
      }

      const updatedGroupMatches = groupMatches.map((match) => {
        if (match.id !== matchId) {
          return match;
        }

        return {
          ...match,
          cupsA: Number(draftResult.cupsA),
          cupsB: Number(draftResult.cupsB),
          isFinished: true
        };
      });

      const normalizedGroupMatches = createGroupMatchesFromGroups(
        groups,
        updatedGroupMatches
      );

      const recalculatedGroups = calculateGroupsFromMatches(
        groups,
        normalizedGroupMatches
      );

      await saveGroupMatchesToFirebase(
        recalculatedGroups,
        normalizedGroupMatches,
        `${matchToSave.teamA} gegen ${matchToSave.teamB} wurde gespeichert.`
      );
    } catch (error) {
      console.error("Fehler beim Speichern des Gruppenspiels:", error);
      setFirebaseError("Das Gruppenspiel konnte nicht gespeichert werden.");
    }
  }

  async function handleClearGroupMatch(matchId) {
    try {
      const matchToClear = groupMatches.find((match) => match.id === matchId);

      if (!matchToClear) {
        return;
      }

      const updatedGroupMatches = groupMatches.map((match) => {
        if (match.id !== matchId) {
          return match;
        }

        return {
          ...match,
          cupsA: "",
          cupsB: "",
          isFinished: false
        };
      });

      const normalizedGroupMatches = createGroupMatchesFromGroups(
        groups,
        updatedGroupMatches
      );

      const recalculatedGroups = calculateGroupsFromMatches(
        groups,
        normalizedGroupMatches
      );

      await saveGroupMatchesToFirebase(
        recalculatedGroups,
        normalizedGroupMatches,
        `${matchToClear.teamA} gegen ${matchToClear.teamB} wurde zurückgesetzt.`
      );
    } catch (error) {
      console.error("Fehler beim Zurücksetzen des Gruppenspiels:", error);
      setFirebaseError("Das Gruppenspiel konnte nicht zurückgesetzt werden.");
    }
  }

  async function handleSaveAllGroupMatches() {
    try {
      for (const match of groupMatches) {
        const draftResult = draftMatchResults[match.id];

        if (!draftResult?.cupsA && !draftResult?.cupsB) {
          continue;
        }

        const validationError = validateCupResult(
          draftResult.cupsA,
          draftResult.cupsB
        );

        if (validationError) {
          setFirebaseError(`Spiel ${match.matchNumber} in ${match.groupName}: ${validationError}`);
          return;
        }
      }

      const updatedGroupMatches = groupMatches.map((match) => {
        const draftResult = draftMatchResults[match.id];

        if (!draftResult || !isFilledNumber(draftResult.cupsA) || !isFilledNumber(draftResult.cupsB)) {
          return {
            ...match,
            cupsA: "",
            cupsB: "",
            isFinished: false
          };
        }

        return {
          ...match,
          cupsA: Number(draftResult.cupsA),
          cupsB: Number(draftResult.cupsB),
          isFinished: true
        };
      });

      const normalizedGroupMatches = createGroupMatchesFromGroups(
        groups,
        updatedGroupMatches
      );

      const recalculatedGroups = calculateGroupsFromMatches(
        groups,
        normalizedGroupMatches
      );

      await saveGroupMatchesToFirebase(
        recalculatedGroups,
        normalizedGroupMatches,
        "Alle eingetragenen Gruppenspiele wurden gespeichert."
      );
    } catch (error) {
      console.error("Fehler beim Speichern aller Gruppenspiele:", error);
      setFirebaseError("Die Gruppenspiele konnten nicht gespeichert werden.");
    }
  }

  function getSortedTeamsFromGroup(group) {
    return [...(group.teams || [])]
      .map((team, index) => ({
        ...team,
        points: getNumber(team.points),
        cupsFor: getNumber(team.cupsFor),
        cupsAgainst: getNumber(team.cupsAgainst),
        cupDifference: getNumber(team.cupDifference),
        originalIndex: index
      }))
      .sort((teamA, teamB) => {
        const teamComparison = compareTeams(teamA, teamB);

        if (teamComparison !== 0) {
          return teamComparison;
        }

        return teamA.originalIndex - teamB.originalIndex;
      });
  }

  function createQualifiedTeam(team, group, placement) {
    const groupSeed = group.groupNumber
      ? `G${group.groupNumber}`
      : group.name.replace("Gruppe ", "G");
    const cupStats = getCupStats(team);

    return {
      name: team.name,
      points: getNumber(team.points),
      cupsFor: cupStats.cupsFor,
      cupsAgainst: cupStats.cupsAgainst,
      cupDifference: cupStats.cupDifference,
      groupName: group.name,
      placement,
      seed: `${groupSeed}-${placement}`
    };
  }

  function createBestThirdPlaces(sortedGroups) {
    return sortedGroups
      .map((group) => createQualifiedTeam(group.teams[2], group, 3))
      .sort(compareTeams)
      .slice(0, 4)
      .map((team, index) => ({
        ...team,
        originalSeed: team.seed,
        seed: `BD${index + 1}`,
        bestThirdRank: index + 1
      }));
  }

  async function handleGenerateKnockoutPhase() {
    try {
      const tournamentRef = doc(db, "tournaments", "current");
      const normalizedGroupMatches = createGroupMatchesFromGroups(
        groups,
        groupMatches
      );

      const recalculatedGroups = calculateGroupsFromMatches(
        groups,
        normalizedGroupMatches
      );

      const sortedGroups = recalculatedGroups.map((group, index) => ({
        ...group,
        groupNumber: index + 1,
        teams: getSortedTeamsFromGroup(group)
      }));

      const groupWinners = sortedGroups.map((group) =>
        createQualifiedTeam(group.teams[0], group, 1)
      );

      const groupSecondPlaces = sortedGroups.map((group) =>
        createQualifiedTeam(group.teams[1], group, 2)
      );

      const bestThirdPlaces = createBestThirdPlaces(sortedGroups);

      if (
        groupWinners.length !== 6 ||
        groupSecondPlaces.length !== 6 ||
        bestThirdPlaces.length !== 4
      ) {
        setFirebaseError("Für das Achtelfinale müssen 6 Gruppen mit jeweils 4 Teams vorhanden sein.");
        return;
      }

      const newBracket = {
        champion: null,
        rounds: [
          {
            name: "Achtelfinale",
            matches: [
              {
                id: "af1",
                teamA: groupWinners[0],
                teamB: bestThirdPlaces[3],
                winner: null
              },
              {
                id: "af2",
                teamA: groupSecondPlaces[3],
                teamB: groupSecondPlaces[4],
                winner: null
              },
              {
                id: "af3",
                teamA: groupWinners[2],
                teamB: groupSecondPlaces[5],
                winner: null
              },
              {
                id: "af4",
                teamA: groupSecondPlaces[1],
                teamB: bestThirdPlaces[1],
                winner: null
              },
              {
                id: "af5",
                teamA: groupWinners[1],
                teamB: bestThirdPlaces[2],
                winner: null
              },
              {
                id: "af6",
                teamA: groupSecondPlaces[2],
                teamB: groupWinners[3],
                winner: null
              },
              {
                id: "af7",
                teamA: groupWinners[4],
                teamB: groupSecondPlaces[0],
                winner: null
              },
              {
                id: "af8",
                teamA: groupWinners[5],
                teamB: bestThirdPlaces[0],
                winner: null
              }
            ]
          },
          {
            name: "Viertelfinale",
            matches: [
              {
                id: "qf1",
                teamA: null,
                teamB: null,
                winner: null
              },
              {
                id: "qf2",
                teamA: null,
                teamB: null,
                winner: null
              },
              {
                id: "qf3",
                teamA: null,
                teamB: null,
                winner: null
              },
              {
                id: "qf4",
                teamA: null,
                teamB: null,
                winner: null
              }
            ]
          },
          {
            name: "Halbfinale",
            matches: [
              {
                id: "sf1",
                teamA: null,
                teamB: null,
                winner: null
              },
              {
                id: "sf2",
                teamA: null,
                teamB: null,
                winner: null
              }
            ]
          },
          {
            name: "Finale",
            matches: [
              {
                id: "final",
                teamA: null,
                teamB: null,
                winner: null
              }
            ]
          }
        ]
      };

      await setDoc(
        tournamentRef,
        {
          groups: recalculatedGroups,
          groupMatches: normalizedGroupMatches,
          bracket: newBracket,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setGroups(recalculatedGroups);
      setGroupMatches(normalizedGroupMatches);
      setBracket(newBracket);
      setSaveMessage("Achtelfinale wurde erfolgreich generiert.");
      setFirebaseError("");
    } catch (error) {
      console.error("Fehler beim Erstellen der K.O.-Phase:", error);
      setFirebaseError("Die K.O.-Phase konnte nicht erstellt werden.");
    }
  }

  function clearWinnerAndFollowingMatches(updatedRounds, roundIndex, matchIndex) {
    const match = updatedRounds[roundIndex]?.matches[matchIndex];

    if (!match) {
      return;
    }

    match.winner = null;

    const route = winnerRoutes[match.id];

    if (!route) {
      return;
    }

    const nextMatch = updatedRounds[route.roundIndex]?.matches[route.matchIndex];

    if (!nextMatch) {
      return;
    }

    nextMatch[route.slot] = null;
    clearWinnerAndFollowingMatches(updatedRounds, route.roundIndex, route.matchIndex);
  }

  async function handleSelectMatchWinner(matchId, winnerTeam) {
    try {
      if (!bracket || !winnerTeam) {
        return;
      }

      const tournamentRef = doc(db, "tournaments", "current");

      const updatedRounds = bracket.rounds.map((round) => ({
        ...round,
        matches: round.matches.map((match) => ({
          ...match,
          teamA: match.teamA ? { ...match.teamA } : null,
          teamB: match.teamB ? { ...match.teamB } : null,
          winner: match.winner ? { ...match.winner } : null
        }))
      }));

      let newChampion = null;

      updatedRounds.forEach((round) => {
        round.matches.forEach((match) => {
          if (match.id === matchId) {
            match.winner = winnerTeam;
          }
        });
      });

      const route = winnerRoutes[matchId];

      if (route) {
        clearWinnerAndFollowingMatches(
          updatedRounds,
          route.roundIndex,
          route.matchIndex
        );

        updatedRounds[route.roundIndex].matches[route.matchIndex][route.slot] =
          winnerTeam;
      }

      if (matchId === "final") {
        newChampion = winnerTeam;
      }

      const updatedBracket = {
        ...bracket,
        champion: newChampion,
        rounds: updatedRounds
      };

      await setDoc(
        tournamentRef,
        {
          bracket: updatedBracket,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setBracket(updatedBracket);
      setSaveMessage(`${winnerTeam.name} wurde als Gewinner eingetragen.`);
      setFirebaseError("");
    } catch (error) {
      console.error("Fehler beim Speichern des Gewinners:", error);
      setFirebaseError("Der Gewinner konnte nicht gespeichert werden.");
    }
  }

  async function handleClearKnockoutPhase() {
    try {
      const tournamentRef = doc(db, "tournaments", "current");

      await setDoc(
        tournamentRef,
        {
          bracket: null,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setBracket(null);
      setSaveMessage("K.O.-Phase wurde gelöscht.");
      setFirebaseError("");
    } catch (error) {
      console.error("Fehler beim Löschen der K.O.-Phase:", error);
      setFirebaseError("Die K.O.-Phase konnte nicht gelöscht werden.");
    }
  }

  async function handleSaveTournament() {
    try {
      const normalizedGroupMatches = createGroupMatchesFromGroups(
        groups,
        groupMatches
      );

      const recalculatedGroups = calculateGroupsFromMatches(
        groups,
        normalizedGroupMatches
      );

      await saveGroupMatchesToFirebase(
        recalculatedGroups,
        normalizedGroupMatches,
        "Teams, Spielplan und Tabellen wurden online gespeichert."
      );
    } catch (error) {
      setFirebaseError("Speichern fehlgeschlagen. Bist du eingeloggt?");
    }
  }

  async function handleResetTournament() {
    try {
      const tournamentRef = doc(db, "tournaments", "current");
      const freshGroupMatches = createGroupMatchesFromGroups(defaultGroups);

      await setDoc(
        tournamentRef,
        {
          groups: defaultGroups,
          groupMatches: freshGroupMatches,
          bracket: null,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setGroups(defaultGroups);
      setGroupMatches(freshGroupMatches);
      setDraftMatchResults(buildDraftMatchResults(freshGroupMatches));
      setBracket(null);
      setSaveMessage("Turnierdaten wurden zurückgesetzt.");
      setFirebaseError("");
    } catch (error) {
      setFirebaseError("Zurücksetzen fehlgeschlagen. Bist du eingeloggt?");
    }
  }

  function isSameTeam(teamA, teamB) {
    if (!teamA || !teamB) {
      return false;
    }

    return teamA.name === teamB.name && teamA.groupName === teamB.groupName;
  }

  function getTeamName(team) {
    if (!team) {
      return "Noch offen";
    }

    return team.seed ? `${team.seed} ${team.name}` : team.name;
  }

  function getFinishedMatchesCount(groupIndex) {
    return groupMatches.filter(
      (match) => match.groupIndex === groupIndex && match.isFinished
    ).length;
  }

  function getTotalFinishedMatchesCount() {
    return groupMatches.filter((match) => match.isFinished).length;
  }

  function renderWinnerButton(match, team) {
    const isSelectedWinner = isSameTeam(match.winner, team);

    return (
      <button
        type="button"
        className={
          isSelectedWinner
            ? "host-winner-button host-winner-button-active"
            : "host-winner-button"
        }
        disabled={!team}
        onClick={() => handleSelectMatchWinner(match.id, team)}
      >
        Gewinner
      </button>
    );
  }

  if (isLoading) {
    return (
      <main className="host-page">
        <section className="host-hero">
          <p className="host-kicker">Host Bereich</p>
          <h1>Lädt...</h1>
          <p>Die Turnierdaten werden geladen.</p>
        </section>
      </main>
    );
  }

  if (!hostUser) {
    return (
      <main className="host-page">
        <section className="host-hero">
          <p className="host-kicker">Host Login</p>
          <h1>Host Bereich</h1>
          <p>Melde dich an, um Teams, Gruppenspiele und K.O.-Phase zu bearbeiten.</p>
        </section>

        <form className="host-login-form" onSubmit={handleLogin}>
          <label>
            E-Mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="host@email.de"
              required
            />
          </label>

          <label>
            Passwort
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Passwort"
              required
            />
          </label>

          <button type="submit">Einloggen</button>

          {loginError && <p className="login-error">{loginError}</p>}
          {firebaseError && <p className="login-error">{firebaseError}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="host-page">
      <section className="host-hero">
        <p className="host-kicker">Host Bereich</p>
        <h1>Turnier verwalten</h1>

        <button type="button" className="logout-button" onClick={handleLogout}>
          Ausloggen
        </button>
      </section>

      <section className="host-admin-overview">
        <div className="host-status-grid">
          <article className="host-status-card">
            <span>Gruppenspiele</span>
            <strong>{getTotalFinishedMatchesCount()}/36</strong>
            <p>gespeichert</p>
          </article>

          <article className="host-status-card">
            <span>Punkte-System</span>
            <strong>{WIN_POINTS}</strong>
            <p>Punkte pro Sieg</p>
          </article>

          <article className="host-status-card">
            <span>K.O.-Phase</span>
            <strong>{bracket ? "aktiv" : "offen"}</strong>
            <p>{bracket ? "Turnierbaum erstellt" : "noch nicht erstellt"}</p>
          </article>
        </div>

        <div className="host-global-actions">
          <button type="button" onClick={handleSaveAllGroupMatches}>
            Alle Gruppenspiele speichern
          </button>

          <button type="button" onClick={handleSaveTournament}>
            Teams & Tabellen speichern
          </button>

          <button type="button" onClick={handleGenerateKnockoutPhase}>
            Achtelfinale generieren
          </button>

          <button
            type="button"
            className="reset-button"
            onClick={handleClearKnockoutPhase}
          >
            K.O.-Phase löschen
          </button>

          <button
            type="button"
            className="reset-button"
            onClick={handleResetTournament}
          >
            Alles zurücksetzen
          </button>
        </div>

        {saveMessage && <p className="save-message">{saveMessage}</p>}
        {firebaseError && <p className="host-error-message">{firebaseError}</p>}
      </section>

      <section className="host-editor">
        <div className="host-section-header">
          <p className="host-kicker">Teams</p>
          <h2>Teams bearbeiten</h2>
          <p>
            Die Punkte und Becherwerte werden nicht mehr manuell eingetragen,
            sondern automatisch aus den Gruppenspiel-Ergebnissen berechnet.
          </p>
        </div>

        {groups.map((group, groupIndex) => (
          <article className="host-group-card" key={group.name}>
            <h2>{group.name}</h2>

            <div className="host-team-list">
              {group.teams.map((team, teamIndex) => {
                const cupStats = getCupStats(team);

                return (
                  <div
                    className="host-team-row"
                    key={`${group.name}-${teamIndex}`}
                  >
                    <label>
                      Teamname
                      <input
                        type="text"
                        value={team.name}
                        onChange={(event) =>
                          handleTeamNameChange(
                            groupIndex,
                            teamIndex,
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <div className="host-team-stats">
                      <span>{getNumber(team.points)} Pkt.</span>
                      <span>
                        {cupStats.cupsFor}:{cupStats.cupsAgainst}
                      </span>
                      <span>{formatCupDifference(cupStats.cupDifference)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>

      <section className="host-group-results-section">
        <div className="host-section-header">
          <p className="host-kicker">Gruppenphase</p>
          <h2>Ergebnisse eintragen</h2>
          <p>
            Trage pro Spiel die getroffenen Becher ein. Nach dem Speichern wird
            die Gruppentabelle automatisch neu berechnet.
          </p>
        </div>

        <div className="host-result-groups-grid">
          {groups.map((group, groupIndex) => {
            const matchesForGroup = groupMatches.filter(
              (match) => match.groupIndex === groupIndex
            );
            const sortedTeams = getSortedTeamsFromGroup(group);

            return (
              <article className="host-results-group-card" key={group.name}>
                <div className="host-results-card-header">
                  <div>
                    <p className="host-kicker">Spielplan</p>
                    <h3>{group.name}</h3>
                  </div>

                  <span className="host-progress-badge">
                    {getFinishedMatchesCount(groupIndex)}/6 gespielt
                  </span>
                </div>

                <div className="host-group-standings">
                  <div className="host-standings-row host-standings-head">
                    <span>#</span>
                    <span>Team</span>
                    <span>Pk</span>
                    <span>Becher</span>
                    <span>+/-</span>
                  </div>

                  {sortedTeams.map((team, index) => {
                    const cupStats = getCupStats(team);

                    return (
                      <div
                        className="host-standings-row"
                        key={`${group.name}-standing-${team.name}`}
                      >
                        <span>{index + 1}</span>
                        <span>{team.name}</span>
                        <span>{getNumber(team.points)}</span>
                        <span>
                          {cupStats.cupsFor}:{cupStats.cupsAgainst}
                        </span>
                        <span>{formatCupDifference(cupStats.cupDifference)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="host-matches-list">
                  {matchesForGroup.map((match) => {
                    const draftResult = draftMatchResults[match.id] || {
                      cupsA: "",
                      cupsB: ""
                    };
                    const teamAWins =
                      match.isFinished && Number(match.cupsA) > Number(match.cupsB);
                    const teamBWins =
                      match.isFinished && Number(match.cupsB) > Number(match.cupsA);

                    return (
                      <div
                        className={
                          match.isFinished
                            ? "host-result-match-card is-saved"
                            : "host-result-match-card"
                        }
                        key={match.id}
                      >
                        <div className="host-result-match-top">
                          <span>Spiel {match.matchNumber}</span>
                          <strong className="host-match-status">
                            {match.isFinished ? "gespeichert" : "offen"}
                          </strong>
                        </div>

                        <div className="host-result-input-row">
                          <label
                            className={
                              teamAWins
                                ? "host-result-team-side is-winner"
                                : "host-result-team-side"
                            }
                          >
                            <span className="host-result-team-name">
                              {match.teamA}
                            </span>
                            <input
                              className="host-result-score-input"
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="6"
                              value={draftResult.cupsA}
                              onChange={(event) =>
                                handleGroupMatchResultChange(
                                  match.id,
                                  "cupsA",
                                  event.target.value
                                )
                              }
                            />
                          </label>

                          <span className="host-result-divider">:</span>

                          <label
                            className={
                              teamBWins
                                ? "host-result-team-side is-winner"
                                : "host-result-team-side"
                            }
                          >
                            <span className="host-result-team-name">
                              {match.teamB}
                            </span>
                            <input
                              className="host-result-score-input"
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="6"
                              value={draftResult.cupsB}
                              onChange={(event) =>
                                handleGroupMatchResultChange(
                                  match.id,
                                  "cupsB",
                                  event.target.value
                                )
                              }
                            />
                          </label>
                        </div>

                        <div className="host-result-buttons">
                          <button
                            type="button"
                            onClick={() => handleSaveGroupMatch(match.id)}
                          >
                            Ergebnis speichern
                          </button>

                          <button
                            type="button"
                            className="host-secondary-button"
                            onClick={() => handleClearGroupMatch(match.id)}
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="host-knockout-section">
        <div className="host-knockout-header">
          <p className="host-kicker">Finalrunde</p>
          <h2>K.O.-Phase</h2>
          <p>
            Nach dem Generieren kann der Host pro Partie den Gewinner auswählen.
            Die Gewinner werden automatisch in die nächste Runde übernommen.
          </p>
        </div>

        {!bracket && (
          <div className="host-empty-bracket">
            <p>Noch keine K.O.-Phase generiert.</p>
          </div>
        )}

        {bracket && (
          <>
            <div className="host-bracket-grid">
              {bracket.rounds.map((round) => (
                <article className="host-round-card" key={round.name}>
                  <h3>{round.name}</h3>

                  <div className="host-match-list">
                    {round.matches.map((match) => (
                      <div className="host-match-card" key={match.id}>
                        <div className="host-match-team">
                          <span>{getTeamName(match.teamA)}</span>
                          {renderWinnerButton(match, match.teamA)}
                        </div>

                        <div className="host-match-team">
                          <span>{getTeamName(match.teamB)}</span>
                          {renderWinnerButton(match, match.teamB)}
                        </div>

                        {match.winner && (
                          <p className="host-match-winner">
                            Gewinner: {match.winner.name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            {bracket.champion && (
              <div className="host-champion-card">
                <p>Turniersieger</p>
                <h2>{bracket.champion.name}</h2>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

export default HostPanel;
