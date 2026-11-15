// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export interface Choice { value:string;label:string }
export interface WizardAnswers {purpose:string;audience:string;locality:string;situation:string}
export interface WizardRule {
 procedure_id:string;purpose:string;audiences:string[];situations:string[];explanation:string;distinction:string;
 source_reference:string;verified_at:string|null;enabled:boolean
}
export interface WizardProcedure {id:string;title:string;summary:string;category:string;published?:boolean}
export interface WizardMatch {id:string;title:string;summary:string;category:string;score:number;verified:boolean;
 sourceReference:string;explanation:string;distinction:string;notice:string}
export declare const purposes:Choice[]
export declare const audiences:Choice[]
export declare const situations:Choice[]
export declare const localityModes:Choice[]
export declare function matchGuidance(procedures:WizardProcedure[],rules:WizardRule[],answers:WizardAnswers):WizardMatch[]
