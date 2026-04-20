import { useEffect, useState, createContext, useContext } from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import RequestForm from "./pages/RequestForm";
import PublicQuoteApproval from "./pages/PublicQuoteApproval";
import PublicPayment from "./pages/PublicPayment";
import { ErrorBoundary } from "./components/ErrorBoundary";

export const AuthContext = createContext<{ 
  user: User | null; 
  loading: boolean;
  currentUserData: any | null;
  setCurrentUserData: (data: any | null) => void;
  impersonatedUser: { uid: string; role: string; businessId: string } | null;
  setImpersonatedUser: (user: { uid: string; role: string; businessId: string } | null) => void;
}>({ 
  user: null, 
  loading: true,
  currentUserData: null,
  setCurrentUserData: () => {},
  impersonatedUser: null,
  setImpersonatedUser: () => {}
});

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState<any | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<{ uid: string; role: string; businessId: string } | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    let unsubUserDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        unsubUserDoc = onSnapshot(doc(db, "users", authUser.uid), (snap) => {
          if (snap.exists()) {
            setCurrentUserData({ id: snap.id, ...snap.data() });
          } else {
            setCurrentUserData(null);
          }
          setLoading(false);
        });
      } else {
        if (unsubUserDoc) unsubUserDoc();
        setCurrentUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, loading, currentUserData, setCurrentUserData, impersonatedUser, setImpersonatedUser }}>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/solutions" element={<LandingPage />} />
            <Route path="/analytics" element={<LandingPage />} />
            <Route path="/proof" element={<LandingPage />} />
            <Route path="/contact" element={<LandingPage />} />
            <Route path="/request" element={<RequestForm />} />
            <Route path="/quote/:quoteId/approve" element={<PublicQuoteApproval />} />
            <Route path="/pay" element={<PublicPayment />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
          </Routes>
        </Router>
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}
