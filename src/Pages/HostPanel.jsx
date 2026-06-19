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

const winnerRoutes = {
  qf1: { roundIndex: 1, matchIndex: 0, slot: "teamA" },
  qf2: { roundIndex: 1, matchIndex: 0, slot: "teamB" },
  qf3: { roundIndex: 1, matchIndex: 1, slot: "teamA" },
  qf4: { roundIndex: 1, matchIndex: 1, slot: "teamB" },
  sf1: { roundIndex: 2, matchIndex: 0, slot: "teamA" },
  sf2: { roundIndex: 2, matchIndex: 0, slot: "teamB" }
};

function HostPanel() {
  const [groups, setGroups] = useState(defaultGroups);
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

    setGroups(updatedGroups);
    setSaveMessage("");
  }

  function handleTeamPointsChange(groupIndex, teamIndex, newPoints) {
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
            points: Number(newPoints)
          };
        })
      };
    });

    setGroups(updatedGroups);
    setSaveMessage("");
  }

  function getSortedTeamsFromGroup(group) {
    return [...(group.teams || [])]
      .map((team, index) => ({
        ...team,
        points: Number(team.points) || 0,
        originalIndex: index
      }))
      .sort((teamA, teamB) => {
        if (teamB.points !== teamA.points) {
          return teamB.points - teamA.points;
        }

        return teamA.originalIndex - teamB.originalIndex;
      });
  }

  function createQualifiedTeam(team, group, placement) {
    return {
      name: team.name,
      points: Number(team.points) || 0,
      groupName: group.name,
      placement
    };
  }

  async function handleGenerateKnockoutPhase() {
    try {
      const tournamentRef = doc(db, "tournaments", "current");

      const groupWinners = groups.map((group) => {
        const sortedTeams = getSortedTeamsFromGroup(group);
        return createQualifiedTeam(sortedTeams[0], group, "Gruppensieger");
      });

      const bestSecondPlaces = groups
        .map((group) => {
          const sortedTeams = getSortedTeamsFromGroup(group);
          return createQualifiedTeam(sortedTeams[1], group, "Bester Zweiter");
        })
        .sort((teamA, teamB) => {
          if (teamB.points !== teamA.points) {
            return teamB.points - teamA.points;
          }

          return teamA.name.localeCompare(teamB.name);
        })
        .slice(0, 2);

      const qualifiedTeams = [...groupWinners, ...bestSecondPlaces];

      if (qualifiedTeams.length !== 8) {
        setFirebaseError("Es müssen genau 8 Teams für das Viertelfinale vorhanden sein.");
        return;
      }

      const newBracket = {
        champion: null,
        rounds: [
          {
            name: "Viertelfinale",
            matches: [
              {
                id: "qf1",
                teamA: qualifiedTeams[0],
                teamB: qualifiedTeams[7],
                winner: null
              },
              {
                id: "qf2",
                teamA: qualifiedTeams[3],
                teamB: qualifiedTeams[4],
                winner: null
              },
              {
                id: "qf3",
                teamA: qualifiedTeams[1],
                teamB: qualifiedTeams[6],
                winner: null
              },
              {
                id: "qf4",
                teamA: qualifiedTeams[2],
                teamB: qualifiedTeams[5],
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
          bracket: newBracket,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setBracket(newBracket);
      setSaveMessage("K.O.-Phase wurde erfolgreich generiert.");
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
      const tournamentRef = doc(db, "tournaments", "current");

      await setDoc(
        tournamentRef,
        {
          groups,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setSaveMessage("Turnierdaten wurden online gespeichert.");
      setFirebaseError("");
    } catch (error) {
      setFirebaseError("Speichern fehlgeschlagen. Bist du eingeloggt?");
    }
  }

  async function handleResetTournament() {
    try {
      const tournamentRef = doc(db, "tournaments", "current");

      await setDoc(
        tournamentRef,
        {
          groups: defaultGroups,
          bracket: null,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setGroups(defaultGroups);
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

    return team.name;
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
          <p>Melde dich an, um Teams und Punkte zu bearbeiten.</p>
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
        <p>
          Änderungen werden in Firebase gespeichert und automatisch bei allen
          Zuschauern aktualisiert.
        </p>

        <button type="button" className="logout-button" onClick={handleLogout}>
          Ausloggen
        </button>
      </section>

      <section className="host-editor">
        {groups.map((group, groupIndex) => (
          <article className="host-group-card" key={group.name}>
            <h2>{group.name}</h2>

            <div className="host-team-list">
              {group.teams.map((team, teamIndex) => (
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

                  <label>
                    Punkte
                    <input
                      type="number"
                      min="0"
                      value={team.points}
                      onChange={(event) =>
                        handleTeamPointsChange(
                          groupIndex,
                          teamIndex,
                          event.target.value
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </article>
        ))}

        <div className="host-actions">
          <button type="button" onClick={handleSaveTournament}>
            Speichern
          </button>

          <button type="button" onClick={handleGenerateKnockoutPhase}>
            K.O.-Phase generieren
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
            Zurücksetzen
          </button>
        </div>

        {saveMessage && <p className="save-message">{saveMessage}</p>}
        {firebaseError && <p className="host-error-message">{firebaseError}</p>}
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