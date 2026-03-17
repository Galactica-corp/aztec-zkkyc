import { BrowserRouter, Route, Routes } from "react-router";

import { Home } from "../pages/home/home";
import { RqProvider } from "../shared/providers/rq";
import "../styles/index.css";

export const App = () => {
  return (
    <RqProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </RqProvider>
  );
};
