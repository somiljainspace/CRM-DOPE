import argon2 from 'argon2'; export async function hashPassword(p:string){return argon2.hash(p,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:4});}
export async function verifyPassword(p:string,h:string){return argon2.verify(h,p);}
