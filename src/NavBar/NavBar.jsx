import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { GoArrowUpRight } from "react-icons/go";
import { Link } from "react-router-dom";
import "./NavBar.css";

const defaultItems = [
  {
    label: "Tournament",
    bgColor: "#111111",
    textColor: "#ffffff",
    links: [
      {
        label: "Home",
        to: "/",
        ariaLabel: "Go to homepage"
      },
      {
        label: "Turnierbaum",
        to: "/turnierbaum",
        ariaLabel: "Go to tournament tree"
      },
      {
        label: "Gruppenphase",
        to: "/turnierbaum",
        ariaLabel: "Go to group stage"
      }
    ]
  },
  {
    label: "Host",
    bgColor: "#14532d",
    textColor: "#ffffff",
    links: [
      {
        label: "Ergebnisse eintragen",
        to: "/host",
        ariaLabel: "Enter match results"
      },
      {
        label: "Teams verwalten",
        to: "/host",
        ariaLabel: "Manage teams"
      }
    ]
  },
  {
    label: "Info",
    bgColor: "#f3f4f6",
    textColor: "#111111",
    links: [
      {
        label: "Regeln",
        to: "/turnierbaum",
        ariaLabel: "Read tournament rules"
      },
      {
        label: "Zeitplan",
        to: "/turnierbaum",
        ariaLabel: "View schedule"
      }
    ]
  }
];

function NavBar({
  logo,
  logoAlt = "Valush Tournament",
  items = defaultItems,
  className = "",
  ease = "power3.out",
  baseColor = "#ffffff",
  menuColor = "#111111",
  buttonBgColor = "#111111",
  buttonTextColor = "#ffffff"
}) {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const navRef = useRef(null);
  const cardsRef = useRef([]);
  const tlRef = useRef(null);

  const calculateHeight = () => {
    const navEl = navRef.current;
    if (!navEl) return 260;

    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if (isMobile) {
      const contentEl = navEl.querySelector(".card-nav-content");

      if (contentEl) {
        const wasVisible = contentEl.style.visibility;
        const wasPointerEvents = contentEl.style.pointerEvents;
        const wasPosition = contentEl.style.position;
        const wasHeight = contentEl.style.height;

        contentEl.style.visibility = "visible";
        contentEl.style.pointerEvents = "auto";
        contentEl.style.position = "static";
        contentEl.style.height = "auto";

        contentEl.getBoundingClientRect();

        const topBar = 60;
        const padding = 16;
        const contentHeight = contentEl.scrollHeight;

        contentEl.style.visibility = wasVisible;
        contentEl.style.pointerEvents = wasPointerEvents;
        contentEl.style.position = wasPosition;
        contentEl.style.height = wasHeight;

        return topBar + contentHeight + padding;
      }
    }

    return 260;
  };

  const createTimeline = () => {
    const navEl = navRef.current;
    if (!navEl) return null;

    gsap.set(navEl, { height: 60, overflow: "hidden" });
    gsap.set(cardsRef.current, { y: 50, opacity: 0 });

    const tl = gsap.timeline({ paused: true });

    tl.to(navEl, {
      height: calculateHeight,
      duration: 0.4,
      ease
    });

    tl.to(
      cardsRef.current,
      {
        y: 0,
        opacity: 1,
        duration: 0.4,
        ease,
        stagger: 0.08
      },
      "-=0.1"
    );

    return tl;
  };

  useLayoutEffect(() => {
    const tl = createTimeline();
    tlRef.current = tl;

    return () => {
      tl?.kill();
      tlRef.current = null;
    };
  }, [ease, items]);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return;

      if (isExpanded) {
        const newHeight = calculateHeight();
        gsap.set(navRef.current, { height: newHeight });

        tlRef.current.kill();

        const newTl = createTimeline();

        if (newTl) {
          newTl.progress(1);
          tlRef.current = newTl;
        }
      } else {
        tlRef.current.kill();

        const newTl = createTimeline();

        if (newTl) {
          tlRef.current = newTl;
        }
      }
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [isExpanded]);

  const toggleMenu = () => {
    const tl = tlRef.current;
    if (!tl) return;

    if (!isExpanded) {
      setIsHamburgerOpen(true);
      setIsExpanded(true);
      tl.play(0);
    } else {
      setIsHamburgerOpen(false);
      tl.eventCallback("onReverseComplete", () => setIsExpanded(false));
      tl.reverse();
    }
  };

  const closeMenu = () => {
    const tl = tlRef.current;

    if (!tl || !isExpanded) return;

    setIsHamburgerOpen(false);
    tl.eventCallback("onReverseComplete", () => setIsExpanded(false));
    tl.reverse();
  };

  const setCardRef = (i) => (el) => {
    if (el) cardsRef.current[i] = el;
  };

  const renderNavLink = (lnk, i) => {
    return (
      <Link
        key={`${lnk.label}-${i}`}
        className="nav-card-link"
        to={lnk.to || "/"}
        aria-label={lnk.ariaLabel}
        onClick={closeMenu}
      >
        <GoArrowUpRight className="nav-card-link-icon" aria-hidden="true" />
        {lnk.label}
      </Link>
    );
  };

  return (
    <div className={`card-nav-container ${className}`}>
      <nav
        ref={navRef}
        className={`card-nav ${isExpanded ? "open" : ""}`}
        style={{ backgroundColor: baseColor }}
      >
        <div className="card-nav-top">
          <div
            className={`hamburger-menu ${isHamburgerOpen ? "open" : ""}`}
            onClick={toggleMenu}
            role="button"
            aria-label={isExpanded ? "Close menu" : "Open menu"}
            tabIndex={0}
            style={{ color: menuColor }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          <Link className="logo-container" to="/" onClick={closeMenu}>
            {logo ? (
              <img src={logo} alt={logoAlt} className="logo" />
            ) : (
              <span className="logo-text">Valush</span>
            )}
          </Link>

          <Link
            to="/turnierbaum"
            className="card-nav-cta-button"
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
            onClick={closeMenu}
          >
            Bracket
          </Link>
        </div>

        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {(items || []).slice(0, 3).map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="nav-card-label">{item.label}</div>

              <div className="nav-card-links">
                {item.links?.map((lnk, i) => renderNavLink(lnk, i))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default NavBar;