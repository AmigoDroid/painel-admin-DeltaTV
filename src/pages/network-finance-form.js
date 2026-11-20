/** Only authorized Admin/Superadmin can submit these adjustments; the backend reprices. */
export const blankManualCharge=()=>({adminId:'',partnerId:'',kind:'renewal',planTo:'',method:'manual',
 manualType:'',manualValue:'',manualReason:'',stack:false,waive:false,waiveAll:true,
 waiveFee:'0',waiveInterest:'0',waiveReason:''});
export function manualChargeQuote(v){
 return {partnerId:v.partnerId,kind:v.kind,planTo:v.planTo,
  ...(v.manualType?{manualDiscount:{type:v.manualType,value:Number(v.manualValue),stack:!!v.stack,
    reason:v.manualReason?.trim()||''}}:{}),
  ...(v.waive?{waiver:{full:!!v.waiveAll,lateFeeCents:Math.round(Number(v.waiveFee||0)*100),
    interestCents:Math.round(Number(v.waiveInterest||0)*100),reason:v.waiveReason?.trim()||''}}:{})};
}
