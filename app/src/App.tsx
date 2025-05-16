import { RouterProvider, createHashRouter } from 'react-router-dom'
import ClientLayout from './layouts'
import HomePage from './views/homepage'
import ChatPage from './views/chatpage'
import SettingPage from './views/settingpage'
import LoginPage from './views/login'
import { FileProvider } from './providers/FileContext'

import './App.css'
import { Toaster } from "sonner";
import { LanguageProvider } from './providers/LanguageContext'

export default function App() {
  const router = createHashRouter([
    {
      path: '/login',
      element: <LoginPage />
    },
    {
      path: '/',
      element: (
        <FileProvider>
          <ClientLayout />
        </FileProvider>
      ),
      children: [
        {
          path: '/',
          element: <HomePage />
        },
        {
          path: '/chat',
          element: <ChatPage />
        },
        {
          path: '/chat/:id',
          element: <ChatPage />
        },
        {
          path: '/setting',
          element: <SettingPage />
        }
      ]
    }
  ]);

  return (
    <LanguageProvider>
      <Toaster />
      <RouterProvider router={router} />
    </LanguageProvider>
  );
}
