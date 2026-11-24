import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AuthProvider } from './lib/auth'
import { supabase } from './lib/supabase'
import { Categories } from './pages/Categories'
import { GameMaster } from './pages/GameMaster'
import { GameSetup } from './pages/GameSetup'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { Login } from './pages/Login'
import { QuestionEditor } from './pages/QuestionEditor'
import { SetupMissing } from './pages/SetupMissing'
import { Tv } from './pages/Tv'

// HashRouter, damit Unterseiten auf GitHub Pages auch beim Neuladen funktionieren.
export default function App() {
  if (!supabase) return <SetupMissing />

  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          {/* key: neue und bestehende Fragen nutzen getrennte Formular-Instanzen */}
          <Route path="/erfassen" element={<RequireAuth><QuestionEditor key="neu" /></RequireAuth>} />
          <Route path="/frage/:id" element={<RequireAuth><QuestionEditor key="bearbeiten" /></RequireAuth>} />
          <Route path="/bibliothek" element={<RequireAuth><Library /></RequireAuth>} />
          <Route path="/kategorien" element={<RequireAuth><Categories /></RequireAuth>} />
          <Route path="/spiel" element={<RequireAuth><GameSetup /></RequireAuth>} />
          <Route path="/leitung/:id" element={<RequireAuth><GameMaster /></RequireAuth>} />
          {/* Der TV braucht kein Login: Er bekommt Inhalte live von der Spielleitung. */}
          <Route path="/tv" element={<Tv />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
