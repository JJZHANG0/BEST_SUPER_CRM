'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="login-page"><section className="glass login-card"><h1>页面暂时无法加载</h1><p>请检查网络连接后重试。当前演示不会把学生信息保存到设备。</p><button className="primary" onClick={reset}>重新加载</button></section></main>}
