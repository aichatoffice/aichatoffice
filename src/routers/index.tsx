import Home from "@/views/homepage"
import Chat from "@/views/chatpage"

export const routes = [
  { path: "/", element: <Home /> },
  { path: "/chat/:id", element: <Chat /> },
]