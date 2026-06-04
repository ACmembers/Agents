import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ModelManager from './components/ModelManager'
import SettingsPage from './components/SettingsPage'
import PersonaEditor from './components/PersonaEditor'
import SkillEditor from './components/SkillEditor'
import ConversationHistory from './components/ConversationHistory'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<PersonaEditor />} />
        <Route path="/models" element={<ModelManager />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/persona" element={<PersonaEditor />} />
        <Route path="/skills" element={<SkillEditor />} />
        <Route path="/history" element={<ConversationHistory />} />
      </Routes>
    </Layout>
  )
}
