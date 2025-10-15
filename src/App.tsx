import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import MainLayout from "./pages/MainLayout";
import History from "./pages/History";
import Workspace from "./pages/Workspace";
import {useEffect} from "react";

const App = () => {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('accessToken');
        const refreshToken = params.get('refreshToken');

        if (accessToken && refreshToken) {
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);

            window.history.replaceState({}, document.title, '/');
        }
    }, []);

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
