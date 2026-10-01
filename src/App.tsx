import { Navigate, Route, Routes } from "react-router-dom";
import { Backdrop } from "./components/Backdrop";
import { Shell } from "./components/Shell";
import { GarageProvider } from "./lib/garage";
import { useSession } from "./lib/session";
import { CarPage } from "./pages/CarPage";
import { LoginPage } from "./pages/LoginPage";

export function App() {
  return (
    <>
      <Backdrop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function Home() {
  const { me, loading } = useSession();
  if (loading) return <p className="relative z-10 p-8 text-cyan">Opening...</p>;
  if (!me?.authenticated) return <LoginPage />;
  return (
    <GarageProvider>
      <Shell>
        <CarPage />
      </Shell>
    </GarageProvider>
  );
}
