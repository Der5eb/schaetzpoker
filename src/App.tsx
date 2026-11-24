import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AuthProvider } from './lib/auth'
import { supabase } from './lib/supabase'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Placeholder } from './pages/Placeholder'
import { SetupMissing } from './pages/SetupMissing'

// HashRouter, damit Unterseiten auf GitHub Pages auch beim Neuladen funktionieren.
export default function App() {
  if (!supabase) return <SetupMissing />

  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/erfassen" element={<RequireAuth><Placeholder title="Frage erfassen" stage="Etappe 2" /></RequireAuth>} />
          <Route path="/bibliothek" element={<RequireAuth><Placeholder title="Bibliothek" stage="Etappe 2" /></RequireAuth>} />
          <Route path="/spiel" element={<RequireAuth><Placeholder title="Spielabend" stage="Etappe 3" /></RequireAuth>} />
          <Route path="/leitung/:code" element={<RequireAuth><Placeholder title="Spielleitung" stage="Etappe 4" /></RequireAuth>} />
          {/* Die Präsentation braucht kein Login: Sie bekommt Inhalte live von der Spielleitung. */}
          <Route path="/praesentation" element={<Placeholder title="Präsentation" stage="Etappe 3" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
