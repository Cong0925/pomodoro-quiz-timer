/* 冒烟：静态图 /qi-bank、题库列表、题目透传（stem HTML + stem_img）、vite 代理 */
(async () => {
  const out = [];
  const h = await fetch('http://localhost:8888/api/health').then(r => r.json()).catch(e => ({ error: e.message }));
  out.push('健康检查: ' + JSON.stringify(h));

  const banks = await (await fetch('http://localhost:8888/api/practice/banks')).json();
  const xb = banks.filter(b => String(b.name).startsWith('行测真题'));
  out.push('行测真题题库: ' + xb.length + ' 个 → ' + xb.map(b => b.name).join(' | '));

  const gk = xb.find(b => b.name === '行测真题·图形推理');
  const qs = await (await fetch('http://localhost:8888/api/practice/banks/' + gk.id + '/questions')).json();
  const q0 = qs[0];
  out.push('图推题库题目数: ' + qs.length);
  out.push('样例题: id=' + q0.id + ' answer=' + q0.answer + ' stem前80=' + JSON.stringify(String(q0.stem).slice(0, 80)));
  out.push('样例题 stem_img: ' + JSON.stringify(q0.stem_img));
  const imgPath = Array.isArray(q0.stem_img) && q0.stem_img[0] ? q0.stem_img[0] : null;
  if (imgPath) {
    const img = await fetch('http://localhost:8888' + imgPath).catch(e => ({ status: 0, err: e.message }));
    out.push('后端静态图 ' + imgPath + ': ' + img.status + ' ' + (img.headers ? img.headers.get('content-type') : ''));
    const viaProxy = await fetch('http://localhost:8889' + imgPath).catch(e => ({ status: 0, err: e.message }));
    out.push('vite代理图 ' + imgPath + ': ' + viaProxy.status + ' ' + (viaProxy.headers ? viaProxy.headers.get('content-type') : ''));
  }
  console.log(out.join('\n'));
})().catch(e => { console.error('EXCEPTION', e.message); process.exit(1); });
