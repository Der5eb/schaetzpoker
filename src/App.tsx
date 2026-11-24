import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { AuthProvider } from './lib/auth'
import { supabase } from './lib/supabase'
import { Categories } from './pages/Categories'
import { Home } from './pages/Home'
import { Library } from './pages/Library'
import { QuestionEditor } from './pages/QuestionEditor'
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
          {/* key: neue und bestehende Fragen nutzen getrennte Formular-Instanzen */}
          <Route path="/erfassen" element={<RequireAuth><QuestionEditor key="neu" /></RequireAuth>} />
          <Route path="/frage/:id" element={<RequireAuth><QuestionEditor key="bearbeiten" /></RequireAuth>} />
          <Route path="/bibliothek" element={<RequireAuth><Library /></RequireAuth>} />
          <Route path="/kategorien" element={<RequireAuth><Categories /></RequireAuth>} />
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
