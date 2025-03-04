# 前端启动

* chatoffice 前端启动 cd app 后  

```npm install```  ```npm run dev```

* node 推荐版本为 v22.0.0

* vite.config.ts 中 代理改为本地 aichatoffice 服务地址

# 客户端打包

* turboone 打包后放入 electron/server/sdk 下

* aichatoffice 打包后放入 electron/server 下

* electron 打包 ```npm run electron:build```

# 本地起客户端

*  把 electron 中 main.js 中 kernelPort 修改为本地 aichatoffice 服务端口

* 方法一:
  * 手动起 ```npm run dev``` 起前端

  * 起electron ```npm run electron-start```

* 方法二: 
  * 直接一起起 ```npm run electron-dev``` 