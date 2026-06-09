import { HashRouter, Routes, Route } from "react-router-dom";
import NavBar from "./NavBar/NavBar";
import Homepage from "./Pages/Homepage";
import TournamentTree from "./Pages/TournamentTree";
import HostPanel from "./Pages/HostPanel";
import Footer from "./Footer/footer";

function App() {
  return (
    <HashRouter>
      <NavBar />

      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/turnierbaum" element={<TournamentTree />} />
        <Route path="/host" element={<HostPanel />} />
      </Routes>
      
      <Footer />
    </HashRouter>
  );
}

export default App;