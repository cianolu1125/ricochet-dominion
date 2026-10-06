import {searchDecision} from './ai-search.js';
self.onmessage=({data})=>{
  const {requestId,generation,state,session}=data;
  try{const result=searchDecision(state,session);self.postMessage({requestId,generation,...result});}
  catch(error){self.postMessage({requestId,generation,error:String(error?.message||error)});}
};
