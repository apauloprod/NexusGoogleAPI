import { useEffect, useState, createContext, useContext } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebase";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import RequestForm from "./pages/RequestForm";
import { ErrorBoundary } from "./components/ErrorBoundary";

export const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, loading }}>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/request" element={<RequestForm />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
          </Routes>
        </Router>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}
