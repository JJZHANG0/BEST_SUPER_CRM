/** "MM-DD HH:mm" in Asia/Shanghai, the format the UI shows for 状态更新时间. */
export function shanghaiStamp(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.month}-${parts.day} ${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}`;
}
