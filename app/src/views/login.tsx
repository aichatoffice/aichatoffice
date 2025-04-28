import { useState } from 'react';
import logo from '@/assets/logo.png'
import googleIcon from '@/assets/googleIcon.png'
import { GithubIcon, ArrowLeftIcon } from "lucide-react"
import { toast } from 'sonner';
import { isElectron, getIpcRenderer } from "@/utils/electron"

export default function Login() {
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogining, setIsLogining] = useState(false)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = () => {
    if (!validateEmail(email)) {
      toast('请输入有效的邮箱地址');
      return;
    }
    if (!password) {
      alert('请输入密码');
      return;
    }
    console.log('登录信息:', { email, password });
  };

  let authWindow: Window | null = null;

  const handleAuthMessage = (event: MessageEvent) => {
    if (event.origin === 'http://localhost:9001') {
      setIsLogining(false);
      if (event.data.error) {
        toast(event.data.error);
      } else if (event.data.success) {
        console.log('登录成功:', event.data);
        if (isElectron()) {
          const ipcRenderer = getIpcRenderer();
          if (ipcRenderer) {
            ipcRenderer.invoke('set-store-value', 'user', event.data.success?.user);
          }
        } else {
          localStorage.setItem('user', JSON.stringify(event.data.success?.user));
        }
        window.location.href = '/';
      }
      if (authWindow) {
        authWindow.close();
        authWindow = null;
      }
      window.removeEventListener('message', handleAuthMessage);
    }
  };

  const Login = (auth: string) => {
    setIsLogining(true)
    // if (isElectron()) {
    //   const ipcRenderer = getIpcRenderer();
    //   if (ipcRenderer) {
    //     // 创建一个新的 BrowserWindow 用于第三方登录
    //     ipcRenderer.invoke('open-auth-window', {
    //       url: `http://localhost:9001/api/auth/login/${auth}`,
    //       width: 800,
    //       height: 600
    //     }).then((result) => {
    //       if (result) {
    //         console.log('登录成功:', result);
    //       }
    //     }).catch((error) => {
    //       console.error('登录失败:', error);
    //       toast(error.message);
    //     }).finally(() => {
    //       setIsLogining(false);
    //     });
    //   }
    // } else {
    authWindow = window.open(
      `http://localhost:9001/api/auth/login/${auth}`,
      'auth',
      'width=800,height=600,scrollbars=no,resizable=no,menubar=no,toolbar=no,status=no,location=no,titlebar=no'
    );
    // }

    // 添加窗口关闭检测
    const checkWindowClosed = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkWindowClosed);
        setIsLogining(false);
        window.removeEventListener('message', handleAuthMessage);
      }
    }, 500);

    window.addEventListener('message', handleAuthMessage, { once: true });
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {isElectron() && (
        <div className="fixed top-0 left-0 right-0 h-8 flex items-center justify-between px-4 z-50" id="title-bar">
        </div>
      )}
      <div className="max-w-100 w-full space-y-8 p-8 bg-white rounded-2xl shadow-xl relative">
        <div className={`transition-all duration-300 ease-in-out absolute inset-0 ${showEmailLogin ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
          <div className="space-y-8 p-8">
            <div className="text-center">
              <img src={logo} className="w-15 h-15 inline-block" />
            </div>

            <div className="space-y-4">
              <button
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => Login("google")}
                disabled={isLogining}
              >
                <img src={googleIcon} alt="Google" className="w-5 h-5 mr-2" />
                使用 Google 账号登录
              </button>

              <button
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => Login("github")}
                disabled={isLogining}
              >
                <GithubIcon className="w-5 h-5 mr-2" />
                使用 GitHub 账号登录
              </button>
            </div>

            <div className="text-center">
              <button
                onClick={() => setShowEmailLogin(!showEmailLogin)}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200 underline"
                disabled={isLogining}
              >
                邮箱登录
              </button>
            </div>
          </div>
        </div>

        <div className={`transition-all duration-300 ease-in-out ${showEmailLogin ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
          <div className="mt-4 space-y-4 p-2">
            <input
              type="email"
              placeholder="邮箱地址"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            />
            <button
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-800 transition-colors duration-200"
              onClick={handleLogin}
            >
              登录
            </button>
            <button
              className="w-full px-4 py-2 text-gray-400 rounded-md cursor-pointer transition-all duration-200 flex items-center justify-center text-sm hover:text-base h-10 leading-10"
              onClick={() => setShowEmailLogin(false)}
              disabled={isLogining}
            >
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              返回
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}