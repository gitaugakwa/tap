export const styles = `
:root { --ink:#171713; --paper:#f3eee3; --orange:#f45b35; --acid:#e9ff70; --mint:#a7f3bd; --line:rgba(23,23,19,.18); --serif:Georgia,"Times New Roman",serif; --sans:"Arial Narrow",Arial,sans-serif; }
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { margin:0; color:var(--ink); background-color:var(--paper); background-image:linear-gradient(rgba(23,23,19,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(23,23,19,.035) 1px,transparent 1px); background-size:34px 34px; font-family:var(--sans); }
a { color:inherit; text-decoration:none; }
.wrap { width:min(1180px,calc(100% - 48px)); margin-inline:auto; }
.site-header { height:88px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line); }
.brand { display:flex; align-items:center; gap:10px; font-size:20px; font-weight:900; letter-spacing:.12em; }
.brand-mark { width:34px; height:34px; display:grid; place-items:center; border-radius:50%; color:var(--paper); background:var(--ink); font-family:var(--serif); font-style:italic; letter-spacing:0; }
nav { display:flex; gap:32px; font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
nav a,.text-link { border-bottom:1px solid transparent; transition:border-color .2s; }
nav a:hover,.text-link:hover { border-color:currentColor; }
.header-cta { padding:12px 16px; color:white; background:var(--ink); font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.hero { min-height:680px; display:grid; grid-template-columns:1.05fr .95fr; align-items:center; gap:54px; padding-block:66px; }
.eyebrow { display:flex; align-items:center; gap:10px; margin:0 0 20px; font-size:11px; font-weight:900; letter-spacing:.18em; }
.eyebrow span { width:25px; height:2px; background:var(--orange); }
h1,h2 { margin:0; font-family:var(--serif); font-weight:400; letter-spacing:-.055em; line-height:.92; }
.hero h1 { max-width:650px; font-size:clamp(58px,7.1vw,103px); }
.hero-lede { max-width:590px; margin:30px 0; font-size:19px; line-height:1.55; }
.hero-actions { display:flex; align-items:center; gap:28px; }
.button { min-width:225px; padding:18px 20px; display:flex; justify-content:space-between; gap:26px; font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; box-shadow:5px 5px 0 var(--ink); transition:transform .15s,box-shadow .15s; }
.button:hover { transform:translate(3px,3px); box-shadow:2px 2px 0 var(--ink); }
.button-primary { color:var(--ink); background:var(--acid); border:1px solid var(--ink); }
.text-link { width:max-content; padding-block:6px; font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; }
.demo-note { margin-top:42px; font-size:10px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
.demo-note span { margin-inline:8px; color:var(--orange); }
.terminal-stage { min-height:535px; position:relative; display:grid; place-items:center; overflow:hidden; background:var(--orange); border:1px solid var(--ink); }
.sun { width:350px; height:350px; position:absolute; border-radius:50%; background:var(--acid); opacity:.88; }
.stage-note { position:absolute; top:18px; left:20px; margin:0; font-size:10px; font-weight:900; letter-spacing:.14em; line-height:1.4; }
.vertical-label { position:absolute; right:13px; bottom:17px; margin:0; writing-mode:vertical-rl; font-size:9px; font-weight:900; letter-spacing:.18em; }
.phone { width:min(310px,72%); min-height:500px; z-index:1; padding:20px; color:#f8f5ed; background:#171713; border:7px solid #262620; border-radius:37px; box-shadow:16px 18px 0 rgba(23,23,19,.23); transform:rotate(-3deg); }
.phone-top { display:flex; justify-content:space-between; font-size:10px; font-weight:800; }
.signal { color:var(--acid); letter-spacing:.05em; }
.phone-label { margin:48px 0 4px; color:#aaa99f; font-size:10px; letter-spacing:.18em; }
.amount { margin:0 0 26px; font-family:var(--serif); font-size:72px; line-height:1; letter-spacing:-.06em; }
.amount sup { margin-right:5px; color:var(--acid); font-size:25px; }
.merchant-card { display:grid; grid-template-columns:auto 1fr; gap:10px; align-items:center; padding:14px; color:var(--ink); background:#f8f5ed; border-radius:13px; }
.merchant-avatar { width:37px; height:37px; display:grid; place-items:center; border-radius:50%; color:white; background:var(--orange); font-family:var(--serif); font-style:italic; font-weight:700; }
.merchant-card b,.merchant-card small,.verify-name b,.verify-name small { display:block; }
.merchant-card b { font-size:12px; }
.merchant-card small { margin-top:3px; color:#666; font-size:8px; }
.merchant-card i { grid-column:2; width:max-content; padding:3px 6px; color:#175c29; background:var(--mint); font-size:7px; font-style:normal; font-weight:900; letter-spacing:.08em; }
.tap-zone { margin-top:15px; min-height:142px; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#2a2a25; border:1px dashed #5b5b51; border-radius:13px; }
.tap-zone .waves { color:var(--acid); font-family:var(--serif); font-size:29px; letter-spacing:-.2em; transform:rotate(-90deg); }
.tap-zone b { margin-top:10px; font-size:13px; }.tap-zone small { margin-top:5px; color:#aaa99f; font-size:9px; }
.ticker { overflow:hidden; padding:14px 0; color:var(--paper); background:var(--ink); white-space:nowrap; font-size:12px; font-weight:900; letter-spacing:.13em; }
.ticker-track { display:flex; width:max-content; animation:ticker-scroll 28s linear infinite; }.ticker-line { min-width:max(100vw,900px); display:flex; align-items:center; justify-content:space-around; padding-inline:24px; }.ticker b { margin-inline:22px; color:var(--orange); font-size:18px; }.ticker:hover .ticker-track { animation-play-state:paused; }
@keyframes ticker-scroll { to { transform:translateX(-50%); } }
.steps { padding-block:120px; }
.section-heading { display:flex; align-items:end; justify-content:space-between; margin-bottom:65px; }
.section-heading h2,.builder h2 { font-size:clamp(48px,5vw,72px); }.steps ol { margin:0; padding:0; display:grid; grid-template-columns:repeat(3,1fr); list-style:none; border-top:1px solid var(--ink); }
.steps li { position:relative; min-height:350px; padding:22px 28px 30px; border-right:1px solid var(--line); }.steps li:first-child { border-left:1px solid var(--line); }
.steps li>span { font-size:10px; font-weight:900; }.step-icon { width:80px; height:80px; margin:42px 0; display:grid; place-items:center; border-radius:50%; background:var(--acid); font-family:var(--serif); font-size:22px; font-weight:700; }
.steps li:nth-child(2) .step-icon { background:var(--orange); }.steps li:nth-child(3) .step-icon { background:var(--mint); }
.steps h3 { margin:0 0 12px; font-family:var(--serif); font-size:25px; }.steps li p { margin:0; color:#55554d; font-size:14px; line-height:1.55; }
.trust { padding-block:120px; color:var(--paper); background:var(--ink); }.trust-grid { display:grid; grid-template-columns:1fr 1fr; gap:10%; align-items:center; }
.light { color:var(--paper); }.trust-copy h2 { max-width:580px; font-size:clamp(52px,5.6vw,82px); }.trust-copy>p:not(.eyebrow) { max-width:570px; margin:32px 0; color:#bdbbb1; font-size:17px; line-height:1.65; }.trust-copy code { color:var(--acid); }
.verify-card { padding:28px; color:var(--ink); background:var(--paper); box-shadow:14px 14px 0 var(--orange); transform:rotate(2deg); }
.verify-head { display:flex; justify-content:space-between; padding-bottom:20px; border-bottom:1px solid var(--line); font-size:10px; font-weight:900; letter-spacing:.15em; }.verify-head i { padding:4px 7px; color:#175c29; background:var(--mint); font-style:normal; }
.verify-name { display:flex; gap:13px; align-items:center; padding:30px 0; }.verify-name .merchant-avatar { width:54px; height:54px; }.verify-name b { font-family:var(--serif); font-size:23px; }.verify-name small { margin-top:5px; color:#666; }
.verify-card ul { margin:0; padding:0; list-style:none; border-top:1px solid var(--line); }.verify-card li { padding:15px 0; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:10px; border-bottom:1px solid var(--line); font-size:12px; }.verify-card li i { width:8px; height:8px; border-radius:50%; background:#43c66a; }.verify-card li b { font-size:9px; letter-spacing:.1em; }
.verified-stamp { margin-top:24px; padding:17px; text-align:center; color:#175c29; background:var(--mint); font-size:11px; font-weight:900; letter-spacing:.15em; }
.builder { padding-block:120px; display:grid; grid-template-columns:1fr 1fr; gap:10%; align-items:end; }.builder>div:last-child>p { margin:0 0 30px; font-size:18px; line-height:1.6; }.packages { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }.package-link { min-height:94px; padding:17px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; color:var(--paper); background:var(--ink); border:1px solid var(--ink); box-shadow:4px 4px 0 var(--orange); transition:transform .15s,box-shadow .15s,background .15s,color .15s; }.package-link:hover { color:var(--ink); background:var(--acid); box-shadow:2px 2px 0 var(--orange); transform:translate(2px,2px); }.package-link code,.package-link small { display:block; }.package-link code { font-size:12px; font-weight:900; }.package-link small { margin-top:11px; color:#bdbbb1; font-size:10px; line-height:1.4; }.package-link:hover small { color:#47473f; }.package-link b { font-size:16px; }
.final-cta { min-height:430px; position:relative; padding:70px; overflow:hidden; color:var(--paper); background:var(--orange); }.final-cta>p { margin:0 0 20px; font-size:10px; font-weight:900; letter-spacing:.16em; }.final-cta h2 { max-width:700px; margin-bottom:45px; font-size:clamp(70px,9vw,130px); }.final-cta .button { position:relative; z-index:1; }.orb { width:430px; height:430px; position:absolute; right:-60px; bottom:-170px; border-radius:50%; background:var(--acid); }
footer { min-height:155px; display:grid; grid-template-columns:1fr 2fr 1fr; gap:20px; align-items:center; font-size:11px; letter-spacing:.06em; }footer p:last-child { text-align:right; }
.handoff { min-height:100vh; padding:40px 24px; display:grid; place-items:center; background:var(--orange); }.handoff-brand { position:absolute; top:35px; left:40px; }.handoff-card { width:min(620px,100%); padding:55px; background:var(--paper); border:1px solid var(--ink); box-shadow:14px 14px 0 var(--ink); }.handoff-card h1 { margin-bottom:28px; font-size:clamp(52px,8vw,82px); }.handoff-card>p:not(.eyebrow) { margin:0 0 32px; color:#55554d; font-size:17px; line-height:1.6; }.handoff-card .text-link { display:block; margin-top:30px; }.shield { width:82px; height:82px; margin-bottom:32px; display:grid; place-items:center; border-radius:50%; color:var(--ink); background:var(--acid); border:1px solid var(--ink); }.shield span { font-family:var(--serif); font-size:25px; letter-spacing:-.18em; transform:rotate(-90deg); }.handoff-note { position:absolute; bottom:28px; margin:0; font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
@media (max-width:800px) { .wrap{width:min(100% - 28px,620px)} .site-header{height:72px}.site-header nav{display:none}.header-cta{padding:10px}.hero{grid-template-columns:1fr;padding-block:52px;gap:45px}.hero h1{font-size:clamp(54px,16vw,82px)}.terminal-stage{min-height:520px}.section-heading{display:block}.steps{padding-block:85px}.steps ol{grid-template-columns:1fr}.steps li,.steps li:first-child{min-height:270px;border-left:1px solid var(--line);border-bottom:1px solid var(--line)}.step-icon{margin:26px 0}.trust{padding-block:85px}.trust-grid,.builder{grid-template-columns:1fr;gap:65px}.verify-card{transform:none}.builder{padding-block:85px}.packages{grid-template-columns:1fr}.final-cta{padding:50px 28px;min-height:400px}.orb{width:300px;height:300px}footer{padding-block:45px;grid-template-columns:1fr}footer p:last-child{text-align:left}.handoff-card{padding:40px 28px}.handoff-brand{top:22px;left:24px}.handoff-note{width:80%;text-align:center} }
@media (max-width:480px) { .hero-actions{align-items:flex-start;flex-direction:column}.phone{width:82%;min-height:475px}.amount{font-size:62px}.demo-note{line-height:1.8}.final-cta .button{min-width:210px}.handoff{padding-top:95px;padding-bottom:90px}.handoff-card{box-shadow:8px 8px 0 var(--ink)} }
@media (prefers-reduced-motion:reduce) { html{scroll-behavior:auto}.button,.package-link{transition:none}.ticker-track{animation:none}.ticker-line[aria-hidden="true"]{display:none} }
`;
