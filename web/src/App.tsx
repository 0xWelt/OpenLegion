import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { useThemeStore } from './stores/theme'
import Layout from './components/Layout'
import Overview from './pages/Overview'
import Chat from './pages/Chat'
import Channels from './pages/Channels'
import Instances from './pages/Instances'
import Sessions from './pages/Sessions'
import Skills from './pages/Skills'
import Nodes from './pages/Nodes'
import Config from './pages/Config'
import Logs from './pages/Logs'

function App() {
  const { theme } = useThemeStore()

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="chat" element={<Chat />} />
          <Route path="channels" element={<Channels />} />
          <Route path="instances" element={<Instances />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="skills" element={<Skills />} />
          <Route path="nodes" element={<Nodes />} />
          <Route path="config" element={<Config />} />
          <Route path="logs" element={<Logs />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
