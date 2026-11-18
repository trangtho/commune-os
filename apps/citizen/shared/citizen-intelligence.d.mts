// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export function normalizePhrase(value:unknown):string
export function matchSituation(query:string,catalog:Array<{id:string;title:string;summary:string;category:string}>):{items:Array<{id:string;title:string;summary:string;score:number;source:string}>;questions:string[];method:string;notice?:string}
export function nextCaseActions(status:string,applicationId:string,procedureId?:string):Array<{title:string;url:string;reason:string}>
export function groupQuestionTopic(question:string):string
export function compareObservedFields(formData:Record<string,string>,observations:Array<{fields:Record<string,string>;source?:string}>):Array<{field:string;kind:string;sources:string[];message:string}>
export function getForecast(days:number[]):{available:boolean;sampleSize:number;reason?:string;lowerDays?:number;upperDays?:number;confidence?:string;method?:string}
export function guideFormField(field:{key:string;label:string;help?:string;required?:boolean;type:string},procedure?:{source_url?:string|null}):{key:string;label:string;description:string;required:boolean;format:string;source:string|null;notice:string}
