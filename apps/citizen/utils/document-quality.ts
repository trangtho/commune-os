// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
/** Browser-only image signals. Not a trained AI model or document completeness guarantee. */
export async function evaluateImageQuality(file:File):Promise<{width:number;height:number;warnings:string[];method:string}> {
 if(!file.type.startsWith('image/'))return {width:0,height:0,warnings:['PDF: không thể đo độ mờ, lóa hoặc số trang bằng bộ kiểm tra ảnh; vui lòng mở tệp để rà soát.'],method:'not_supported'}
 const image=await createImageBitmap(file)
 try{
  const width=image.width,height=image.height,warnings:string[]=[]
  if(width<900||height<700)warnings.push('Độ phân giải ảnh thấp; nên chụp lại với độ phân giải cao hơn.')
  const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192
  const ctx=canvas.getContext('2d',{willReadFrequently:true})
  if(!ctx)return {width,height,warnings:['Không thể đánh giá chất lượng trên trình duyệt này.'],method:'unavailable'}
  ctx.drawImage(image,0,0,192,192)
  const pixels=ctx.getImageData(0,0,192,192).data
  const gray=new Float32Array(192*192)
  let sum=0,bright=0,dark=0
  for(let i=0;i<gray.length;i++){
   const pos=i*4;const r=pixels[pos]||0,g=pixels[pos+1]||0,b=pixels[pos+2]||0
   const v=.299*r+.587*g+.114*b;gray[i]=v;sum+=v
   if(r>245&&g>245&&b>245)bright++
   if(v<35)dark++
  }
  const mean=sum/gray.length
  if(mean<65||dark/gray.length>.68)warnings.push('Ảnh có thể thiếu sáng; cân nhắc chụp nơi đủ sáng.')
  if(mean>235||bright/gray.length>.75)warnings.push('Ảnh quá sáng hoặc có vùng trắng lớn; hãy kiểm tra bị lóa hoặc mất chữ.')
  let variation=0,count=0
  for(let y=1;y<191;y++)for(let x=1;x<191;x++){
   const k=y*192+x
   const lap=4*gray[k]-(gray[k-1]+gray[k+1]+gray[k-192]+gray[k+192])
   variation+=lap*lap;count++
  }
  // Conservative flag; textureless papers can be sharp, so never block submission.
  if(variation/count<18)warnings.push('Ảnh có ít chi tiết sắc nét; cần kiểm tra chữ có bị mờ hoặc mất nét không.')
  return {width,height,warnings,method:'canvas_heuristics',}
 } finally{image.close()}
}
