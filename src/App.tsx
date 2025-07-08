import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./pages/MainLayout";
import History from "./pages/History";

const App = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<MainLayout />} />
                <Route path="/history" element={<History />} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;
