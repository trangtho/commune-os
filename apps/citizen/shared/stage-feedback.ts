// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export type ReviewStage='guidance'|'reception'|'supplement'|'result'
export const reviewStages:{value:ReviewStage;label:string;description:string}[]=[
  {value:'guidance',label:'Hướng dẫn kê khai',description:'Mức độ dễ hiểu của biểu mẫu và hướng dẫn'},
  {value:'reception',label:'Tiếp nhận hồ sơ',description:'Trải nghiệm gửi và tiếp nhận hồ sơ'},
  {value:'supplement',label:'Bổ sung giấy tờ',description:'Mức độ rõ ràng của yêu cầu bổ sung'},
  {value:'result',label:'Trả kết quả',description:'Trải nghiệm nhận và kiểm tra kết quả'}
]
export function stageEligible(stage:ReviewStage,status:string,eventTypes:string[]):boolean {
  if(stage==='guidance')return true
  if(stage==='reception')return status!=='draft' || eventTypes.includes('submitted')
  if(stage==='supplement')return status==='supplement'||eventTypes.includes('supplement')
  return status==='completed'||eventTypes.includes('completed')
}
