// SPDX-License-Identifier: Apache-2.0
// Syntax-only check; NOT equivalent to Nuxt build/typecheck.
const fs=require('fs'), path=require('path')
let ts
try {ts=require('typescript')} catch {const {execSync}=require('child_process');ts=require(path.join(execSync('npm root -g',{encoding:'utf8'}).trim(),'typescript'))}
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.vue')?[path.join(d,e.name)]:[])}
let fail=0
for (const file of walk(path.join(__dirname,'../apps/commune'))) {
 const content=fs.readFileSync(file,'utf8')
 const match=content.match(/<script\s+setup\s+lang="ts">([\s\S]*?)<\/script>/)
 if (!match) continue
 const result=ts.transpileModule(match[1],{fileName:file+'.ts',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}})
 let problems=(result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error)
 if (problems.length){console.log(file,problems.map(x=>ts.flattenDiagnosticMessageText(x.messageText,'\n')));fail+=problems.length}
 else console.log('OK TS parser',path.basename(file))
}
process.exitCode=fail?1:0
