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

function HostPanel() {
  const [groups, setGroups] = useState(defaultGroups);
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
          }
        } else {
          setGroups(defaultGroups);
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
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      setGroups(defaultGroups);
      setSaveMessage("Turnierdaten wurden zurückgesetzt.");
      setFirebaseError("");
    } catch (error) {
      setFirebaseError("Zurücksetzen fehlgeschlagen. Bist du eingeloggt?");
    }
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
    </main>
  );
}

export default HostPanel;