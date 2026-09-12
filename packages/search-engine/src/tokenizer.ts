import spec from './search-spec.json' with {type:'json'};
const STOP_WORDS=new Set(spec.stop_words);
export const normalizeText=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function stripMarkdownFormatting(raw:string):string{
 return raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/,'')
  .replace(/```[\s\S]*?```/g,' ')
  .replace(/\[([^\]]+)\]\([^)]+\)/g,'$1')
  .replace(/^#{1,6}[ \t]+/gm,'').replace(/^>[ \t]*/gm,'').replace(/[`*_]/g,'')
  .split(/\s+/).filter(Boolean).join(' ');
}
export function tokenizeText(text:string):string[]{
 return normalizeText(stripMarkdownFormatting(text)).split(/[^\p{L}\p{N}]+/u).filter(t=>Array.from(t).length>=2&&!STOP_WORDS.has(t));
}
export function extractSnippet(content:string,terms:string[],maxLen=180):string{
 if(!Number.isSafeInteger(maxLen)||maxLen<=0)return '';
 const chars=Array.from(stripMarkdownFormatting(content));const folded:string[]=[],map:number[]=[];
 chars.forEach((ch,i)=>{for(const c of Array.from(normalizeText(ch))){folded.push(c);map.push(i);}});
 let found=0,matched=false;
 for(const term of terms){const q=Array.from(normalizeText(term));if(!q.length)continue;
  for(let i=0;i+q.length<=folded.length;i++){if(q.every((c,j)=>c===folded[i+j])){found=map[i];matched=true;break;}}
  if(matched)break;
 }
 let start=Math.max(0,found-Math.floor(maxLen/2));if(chars.length-start<maxLen)start=Math.max(0,chars.length-maxLen);
 const end=Math.min(chars.length,start+maxLen);
 return `${start?'...':''}${chars.slice(start,end).join('')}${end<chars.length?'...':''}`;
}
export function computeTermFrequencies(tokens:string[]):Map<string,number>{const m=new Map<string,number>();for(const t of tokens)m.set(t,(m.get(t)||0)+1);return m;}
