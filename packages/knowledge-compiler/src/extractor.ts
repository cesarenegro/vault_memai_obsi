import path from 'node:path';
export interface ExtractedContent {title:string;body:string;extension:string;isSupported:boolean}
// Plain text extraction, never a browser HTML renderer. Malformed/unclosed tags fail closed.
export function sanitizeHtml(raw:string):string {
  let out='',i=0;const blocked:string[]=[];
  while(i<raw.length){
    if(raw[i]!=='<'){if(!blocked.length)out+=raw[i];i++;continue;}
    let j=i+1,quote='';
    for(;j<raw.length;j++){const c=raw[j];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}
    if(j===raw.length)break;
    let token=raw.slice(i+1,j).trim().toLowerCase();const closing=token.startsWith('/');if(closing)token=token.slice(1).trimStart();
    const tag=token.match(/^[a-z0-9]+/)?.[0]??'';
    if(['script','style','iframe','object','template','noscript'].includes(tag)){
      if(closing){if(blocked.at(-1)===tag)blocked.pop();}else blocked.push(tag);
    }
    if(!blocked.length)out+=' ';i=j+1;
  }
  return out.split(/\s+/).filter(Boolean).join(' ').replace(/&/g,'&amp;').replace(/>/g,'&gt;');
}
export function extractTitleFromContent(raw:string,file:string):string {
 return raw.split(/\r?\n/).find(l=>l.startsWith('# '))?.slice(2).trim()||path.parse(file).name;
}
export function extractDeterministicContent(raw:string,file:string):ExtractedContent{
 const ext=path.extname(file).toLowerCase(),html=['.html','.htm'].includes(ext);
 return {title:html?path.parse(file).name:extractTitleFromContent(raw,file),body:html?sanitizeHtml(raw):raw.trim(),extension:ext,isSupported:['.md','.markdown','.txt','.html','.htm'].includes(ext)};
}
