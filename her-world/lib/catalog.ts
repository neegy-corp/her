export const characters = [
 { id: 'olivia', name: 'Olivia', tier: 'Original', subtitle: 'The face of HER.', image: '/images/olivia.jpg', faceId: 'rca764a6a197', description: 'The original HER. Familiar face, candid conversations, and a front-row seat to AGI in the trenches.' },
 { id: 'maya', name: 'Maya', tier: 'Pro', subtitle: 'A different kind of presence.', image: '/images/maya.jpg', faceId: 'r1ce7f5b22d4', description: 'A new face for the same world. Meet Maya before Pro character access opens.' },
 { id: 'ivy', name: 'Ivy', tier: 'Pro', subtitle: 'Meet your next main character.', image: '/images/ivy.jpg', faceId: 'r5ad3b1690f0', description: 'Another way to meet HER. Meet Ivy, one of the first two Pro system characters.' },
];
export type Character = typeof characters[number];
export type PublicConfig = { enabled:boolean; stageEnabled:boolean; mint:string; symbol:string; proAmount:string; stageAmount:string; turnkeyOrganizationId:string; turnkeyAuthProxyConfigId:string; hostConfigured:boolean };
export const emptyConfig:PublicConfig={enabled:false,stageEnabled:false,mint:'',symbol:'HER',proAmount:'',stageAmount:'',turnkeyOrganizationId:'',turnkeyAuthProxyConfigId:'',hostConfigured:false};
export type Receipt={id:string; wallet:string; kind:string; character:string|null; amount:string; signature:string; created_at:number};
export type StageRequest={id:string;wallet:string;name:string;topic:string;status:string;created_at:number;signature:string;amount:string;invite_url?:string|null};
export type Viewer={wallet:string|null;isHost:boolean;unlocks:string[];receipts:Receipt[];requests:StageRequest[]};
export const emptyViewer:Viewer={wallet:null,isHost:false,unlocks:[],receipts:[],requests:[]};
export const shortWallet=(s:string)=>s.length>15?`${s.slice(0,5)}…${s.slice(-5)}`:s;
