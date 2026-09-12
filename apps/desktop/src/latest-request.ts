// Only the newest request may publish data or errors, including after a Vault change.
export function createLatestRequest<T>() {
  let sequence=0;
  return {
    invalidate(){sequence++;},
    async run(operation:()=>Promise<T>,success:(value:T)=>void,failure:(error:unknown)=>void){
      const ticket=++sequence;
      try{const value=await operation();if(ticket===sequence)success(value);}
      catch(error){if(ticket===sequence)failure(error);}
    },
  };
}
