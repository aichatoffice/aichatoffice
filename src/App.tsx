import { RouterProvider, createHashRouter } from 'react-router-dom'
import ClientLayout from './layouts'
import HomePage from './views/homepage'
import ChatPage from './views/chatpage'
import { LanguageProvider } from './providers/LanguageContext'
import { FileProvider } from './providers/FileContext'
import './App.css'

const router = createHashRouter([
  {
    path: '/',
    element: (
      <LanguageProvider>
        <FileProvider>
          <ClientLayout />
        </FileProvider>
      </LanguageProvider>
    ),
    children: [
      {
        path: '/',
        element: <HomePage />
      },
      {
        path: '/chat/:id',
        element: <ChatPage />
      }
    ]
  }
])

export default function App() {
  return <RouterProvider router={router} />
}
