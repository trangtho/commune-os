// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export const lifeEvents:readonly {code:string;name:string;hints:string[]}[]
export function detectLifeEvent(text:string):string
export function clarificationQuestions(input:Record<string,unknown>):{key:string;label:string;choices:string[]}[]
export function buildLifeJourney(situation:string,catalog:{id:string;title:string;summary:string;category:string;documents?:{document_code:string;document_name:string;is_required:boolean}[];fee_note?:string;sla_days?:number}[],options?:Record<string,unknown>):{event:string;items:{id:string;title:string;summary:string;position:number;documents:{code:string;name:string;required:boolean}[];fee:string|null;durationDays:number|null;source:string;legalSourceVerified:boolean;dependency:string;canParallel:null}[];questions:{key:string;label:string;choices:string[]}[];canSave:boolean;notice:string;method:string;sequenceStatus:string}
export function compareChannels(procedure:{fee_note?:string},opts?:{online?:boolean;counter?:boolean;hybrid?:boolean}):{ways:{code:string;title:string;visits:null;available:boolean;why:string}[];feeNote:string;notice:string}
export function explainCaseStatus(status:string,events?:any[],stages?:any[]):{summary:string;latestNote:string|null;stage:string|null;unit:string|null;reason:string|null;actions:any[];notice:string}
export function followupTasks(cases?:any[]):{caseId:string;procedure:string;kind:string;title:string;reason:string;url:string;updatedAt:string}[]
