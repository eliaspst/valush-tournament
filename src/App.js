import { BrowserRouter, Routes, Route } from "react-router-dom";
import NavBar from "./NavBar/NavBar";
import Homepage from "./Pages/Homepage";
import TournamentTree from "./Pages/TournamentTree";
import HostPanel from "./Pages/HostPanel";

function App() {
  return (
    <BrowserRouter>
      <NavBar />

      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/turnierbaum" element={<TournamentTree />} />
        <Route path="/host" element={<HostPanel />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;