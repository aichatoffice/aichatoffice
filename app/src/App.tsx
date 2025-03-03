import { RouterProvider, createHashRouter } from 'react-router-dom'
import ClientLayout from './layouts'
import HomePage from './views/homepage'
import ChatPage from './views/chatpage'
import { FileProvider } from './providers/FileContext'
import { IntlProvider } from "react-intl"
import zh from './locales/zh-CN'
import en from './locales/en-Us'
import './App.css'
import { useState } from 'react'

const messages: Record<string, any> = {
  'zh-CN': zh,
  'en-US': en
}

const defaultLocale = navigator.language.split('-')[0] === 'zh' ? 'zh-CN' : 'en-US';

export default function App() {
  const [locale, setLocale] = useState(defaultLocale);

  const router = createHashRouter([
    {
      path: '/',
      element: (
        <FileProvider>
          <ClientLayout onLanguageChange={setLocale} currentLocale={locale} />
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
        }
      ]
    }
  ]);

  return (
    <IntlProvider locale={locale} messages={messages[locale]} defaultLocale="zh-CN">
      <RouterProvider router={router} />
    </IntlProvider>
  );
}
