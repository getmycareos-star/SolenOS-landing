import { NextResponse } from "next/server";
import { getBackendOrigin } from "@/lib/backend-origin";
export const runtime = "nodejs";
const MAX_FILES = 5, MAX_SHARED_BYTES = 5 * 1024 * 1024;
type CreateResponse = { id?: string; detail?: string };
async function createPersistentShare(payload: { title?: string; text?: string; url?: string; files: Array<{name:string;mimeType:string;base64:string}> }): Promise<{id:string}|{error:string;status:number}> {
  try {
    const response = await fetch(new URL("/api/v1/share-intake", getBackendOrigin()), {
      method:"POST", headers:{"Content-Type":"application/json",Accept:"application/json"}, body:JSON.stringify(payload), cache:"no-store",
    });
    const data = await response.json().catch(()=>({})) as CreateResponse;
    if (!response.ok || !data.id) return {error:data.detail || "The care backend did not confirm the shared content was saved.",status:response.ok?502:response.status};
    return {id:data.id};
  } catch { return {error:"The care backend could not be reached. Shared content was not saved.",status:502}; }
}
export async function POST(request:Request) {
  try {
    const form=await request.formData(), title=field(form,"title"), text=field(form,"text"), url=field(form,"url");
    const files:Array<{name:string;mimeType:string;base64:string}>=[];
    let total=0;
    for(const item of form.getAll("files")) {
      if(!(item instanceof File)||!item.size) continue;
      if(files.length>=MAX_FILES) return NextResponse.json({error:"Share up to five files at a time."},{status:413});
      total+=item.size;
      if(total>MAX_SHARED_BYTES) return NextResponse.json({error:"Shared files exceed the 5 MB limit."},{status:413});
      files.push({name:item.name||"shared-file",mimeType:item.type||"application/octet-stream",base64:Buffer.from(await item.arrayBuffer()).toString("base64")});
    }
    const combined=[title,text,url].filter(Boolean).join("\n").trim();
    if(!combined&&!files.length) return NextResponse.redirect(new URL("/workspace?enter=1",request.url),303);
    const created=await createPersistentShare({title:title||undefined,text:combined||undefined,url:url||undefined,files});
    if("error" in created) return NextResponse.json({error:created.error},{status:created.status});
    const destination=new URL("/workspace?enter=1",request.url); destination.searchParams.set("share_id",created.id);
    return NextResponse.redirect(destination,303);
  } catch { return NextResponse.json({error:"Shared content could not be processed."},{status:400}); }
}
export async function GET(request:Request) {
  const url=new URL(request.url), title=url.searchParams.get("title")??"", text=url.searchParams.get("text")??"", sharedUrl=url.searchParams.get("url")??"";
  const combined=[title,text,sharedUrl].filter(Boolean).join("\n").trim();
  if(!combined) return NextResponse.redirect(new URL("/share",request.url),303);
  const created=await createPersistentShare({title:title||undefined,text:combined,url:sharedUrl||undefined,files:[]});
  if("error" in created) return NextResponse.json({error:created.error},{status:created.status});
  const destination=new URL("/workspace?enter=1",request.url); destination.searchParams.set("share_id",created.id);
  return NextResponse.redirect(destination,303);
}
function field(form:FormData,key:string):string { const value=form.get(key); return typeof value==="string"?value.trim():""; }
