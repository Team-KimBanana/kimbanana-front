import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import MainLayout from "./pages/MainLayout";
import History from "./pages/History";
import Workspace from "./pages/Workspace";

const App = () => {
    return (
        <AuthProvider>
            <BrowserRouter basename="/kimbanana/ui">
                <Routes>
                    <Route path="/" element={<Workspace />} />
                    <Route path="/editor/:id" element={<MainLayout />} />
                    <Route path="/history/:presentationId" element={<History />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
};

export default App;
