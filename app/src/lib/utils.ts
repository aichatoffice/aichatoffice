import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 时间戳转规则时间 
 * 当日：不展示日期，只展示时间
  非当日，本年内：只展示「月+日」
  非本年：展示「年+月+日」
*/
export function formatDate(timestamp: number) {
  if (!timestamp) { return "/" }
  const now = new Date(); // 当前时间
  const targetDate = new Date(timestamp * 1000); // 转换目标时间戳为日期对象

  // 获取各个时间部分
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1; // 月份是从0开始的，需加1
  const day = targetDate.getDate();
  const hours = targetDate.getHours();
  const minutes = targetDate.getMinutes();

  // 判断日期范围
  const isSameDay = now.toDateString() === targetDate.toDateString(); // 是否是同一天
  const isSameYear = now.getFullYear() === year; // 是否是同一年

  const timeDifference = now.getTime() - targetDate.getTime(); // 时间差，单位毫秒
  const differenceInSeconds = Math.floor(timeDifference / 1000); // 时间差，单位秒
  const differenceInMinutes = Math.floor(differenceInSeconds / 60); // 时间差，单位分钟

  let formattedDate = '';

  if (differenceInMinutes < 1) {
    // 时间差小于 1 分钟，显示 "刚刚"
    formattedDate = '刚刚';
  } else if (differenceInMinutes < 10) {
    // 时间差小于 10 分钟，显示 "X 分钟前"
    formattedDate = `${differenceInMinutes}分钟前`;
  } else if (isSameDay) {
    // 当天：不展示日期，只展示时间
    formattedDate = `今天 ${padZero(hours)}:${padZero(minutes)}`;
  } else if (isSameYear) {
    // 今年：展示「月+日」
    formattedDate = `${padZero(month)}月${padZero(day)}日 ${padZero(hours)}:${padZero(minutes)}`;
  } else {
    // 非本年：展示「年+月+日」
    formattedDate = `${year}年${padZero(month)}月${padZero(day)}日 ${padZero(hours)}:${padZero(minutes)}`;
  }

  return formattedDate;
}

// 补零函数，确保时间格式为2位
function padZero(num: number) {
  return num < 10 ? '0' + num : num;
}

