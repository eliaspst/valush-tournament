import { Link } from "react-router-dom";
import "./footer.css";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        
        <div className="footer-line"></div>

        <div className="footer-main">
          <div className="footer-column">
            <h3>Valush Bierpong Turnier</h3>

            <p>
              Das offizielle Bierpong Turnier 2026. Gruppenphase, Ergebnisse
              und Finalrunde an einem Ort.
            </p>
          </div>

          <div className="footer-column">
            <h3>Turnier</h3>

            <div className="footer-links">
              <Link to="/">Home</Link>
              <Link to="/turnierbaum">Turnierbaum</Link>
              <Link to="/turnierbaum">Gruppenphase</Link>
              <Link to="/turnierbaum">Ergebnisse</Link>
            </div>
          </div>

          <div className="footer-column">
            <h3>Infos</h3>

            <div className="footer-info">
              <div>
                <span>Teams</span>
                <strong>24</strong>
              </div>

              <div>
                <span>Gruppen</span>
                <strong>6</strong>
              </div>

              <div>
                <span>Modus</span>
                <strong>Group + KO</strong>
              </div>
            </div>
          </div>

        </div>

        <div className="footer-line"></div>

        <div className="footer-bottom">
          <p>© {currentYear} Valush Bierpong Turnier</p>

          <Link to="/host" className="footer-host-link">
            Host Login
          </Link>
        </div>
      </div>
    </footer>
  );
}