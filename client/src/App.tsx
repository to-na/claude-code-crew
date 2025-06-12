import { Box } from '@mui/material'
import SessionManager from './pages/SessionManager'

function App() {
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <SessionManager />
    </Box>
  )
}

export default App