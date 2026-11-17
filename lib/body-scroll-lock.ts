// Nested presentation, instrument and navigation share one body lock. Restore
// the original value only after the last owner releases, in either cleanup order.
const locks=new WeakMap<HTMLElement,{count:number;overflow:string}>();

export function lockBodyScroll(){
  const body=document.body;
  let state=locks.get(body);
  if(!state){state={count:0,overflow:body.style.overflow};locks.set(body,state);}
  state.count++;
  body.style.overflow="hidden";
  let released=false;
  return ()=>{
    if(released)return;
    released=true;
    if(--state.count===0){body.style.overflow=state.overflow;locks.delete(body);}
  };
}
