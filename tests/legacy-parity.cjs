// Verifies that CONFIG_COLUMNAS seed templates produce exactly the rows legacy/codigo.gs writes.
// Run: node tests/legacy-parity.cjs
const fs=require('fs'),vm=require('vm');
const rows=[];
const est={datosPersonales:{apellidosNombres:'PEREZ  LOPEZ JUAN',documentoIdentidad:'123',celulares:'777'},datosColegio:{colegio:'COL X',departamento:'COCHABAMBA'}};
const ctx={SpreadsheetApp:{getUi:()=>({}),getActiveSpreadsheet:()=>({getSheetByName:n=>({appendRow:r=>rows.push([n,r])})}),openById:()=>({getSheetByName:n=>({appendRow:r=>rows.push(['INCENTIVOS',r])})})},
 PropertiesService:{getUserProperties:()=>({getProperty:()=>JSON.stringify(est)})},Logger:{log(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../legacy/codigo.gs'),'utf8'),ctx);
const seed={};vm.createContext(seed);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../apps-script/seedConfig.gs'),'utf8'),seed);
const keys=['fecha','asesor','anioPromocion','carrera','tipoInscripcion','tipoEstudiante','pack','etapa','observaciones','plan','metodoPago','incentivo','estadoIncentivo','hojaDeVida','autorizacion','contrato','firma','pagosPendientes','carnet','titulo','tituloGratis','certificado','fotos','libreta','documentoIncentivo','universidad','ingles','matematicas','fisica','quimica','lectoescritura'];
const data=Object.fromEntries(keys.map(k=>[k,'v_'+k]));
const dep=c=>{const m=seed.SEED_DEPARTAMENTOS.find(r=>r[0]===c)||seed.SEED_DEPARTAMENTOS.find(r=>r[0]==='*');return m[1]};
const student={nombre:'PEREZ LOPEZ JUAN',ci:'123',celular:'777',colegio:'COL X',departamentoColegio:'COCHABAMBA'};
const build=(tpl,d)=>seed.SEED_COLUMNAS[tpl].map(t=>!t?'':t[0]=='"'?t.slice(1,-1):t=='@departamentoCarrera'?dep(d.carrera):(t in student?student[t]:d[t]));
let ok=true;const check=(name,a,b)=>{const same=JSON.stringify(a)===JSON.stringify(b);ok&=same;console.log(name,same?'OK':'DIFF',a.length,b.length);if(!same)a.forEach((x,i)=>x!==b[i]&&console.log('  col',i,JSON.stringify(x),JSON.stringify(b[i])))};
for(const carrera of ['ODONTOLOGIA','DERECHO','INGENIERIA CIVIL','INGENIERIA QUIMICA']){
 const d={...data,carrera};
 rows.length=0; ctx.getDataFromUIMedicinaPre(d,'PRE UCB MED 1'); check('MED '+carrera,rows[0][1],build('PRE_MED',d));
 rows.length=0; ctx.getDataFromUIPreGeneral(d,'PRE UCB GENERAL'); check('GEN '+carrera,rows[0][1],build('PRE_GENERAL',d));
 for (const grupo of ['PRE UCB MED 2','PRE UCB GENERAL 2']){
  rows.length=0; ctx.getDataFromUINuevosCarreras({...d,incentivo:'APOYO FAMILIAR',grupoPreUCB:grupo});
  check('NUEVOS '+carrera,rows[0][1],build('NUEVOS',{...d,incentivo:'APOYO FAMILIAR'}));
  check(' INCENT',rows[1][1],build('INCENTIVOS',{...d,incentivo:'APOYO FAMILIAR'}));
  const pd={...d,plan:'CATO HOLIDAY GRATIS',metodoPago:'GRATIS'};
  check(' PROMO '+grupo,rows[2][1],build(grupo.includes('MED')?'PRE_MED':'PRE_GENERAL',pd));
 }
}
console.log(ok?'ALL EQUAL':'MISMATCH'); process.exit(ok?0:1);
