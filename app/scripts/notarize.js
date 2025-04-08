import { notarize } from '@electron/notarize';
import fs from 'fs';
import path from 'path';

export default async function notarizing(context) {
  const { electronPlatformName } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // 检查环境变量
  if (!process.env.APPLE_ID || !process.env.APPLE_ID_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.error('缺少必要的环境变量: APPLE_ID, APPLE_ID_PASSWORD, 或 APPLE_TEAM_ID');
    return;
  }

  // 获取 .app 文件路径
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  // 检查应用是否存在
  if (!fs.existsSync(appPath)) {
    console.error(`应用程序不存在: ${appPath}`);
    return;
  }

  console.log(`开始公证应用程序: ${appPath}`);

  try {
    await notarize({
      appBundleId: 'com.aichatoffice.aichatoffice',
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_ID_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    });
    console.log('公证成功完成');
  } catch (error) {
    console.error('公证过程出错:', error);
    throw error;
  }
} 