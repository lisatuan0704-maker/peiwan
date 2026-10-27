export const CATEGORIES=['付款與儲值','訂單與服務','帳號與登入','其他問題'];
export function ticketInput({category,subject,text,orderId=''}) {
  const data={category,subject:String(subject||'').trim(),text:String(text||'').trim(),orderId:String(orderId||'').trim()};
  if(!CATEGORIES.includes(category)) throw Error('請選擇問題類型。');
  if(data.subject.length<2||data.subject.length>60) throw Error('主旨請填寫 2 至 60 字。');
  if(data.text.length<5||data.text.length>1500) throw Error('問題說明請填寫 5 至 1500 字。');
  if(data.orderId.length>80) throw Error('訂單編號最多 80 字。');
  return data;
}
export function replyUpdates({uid,id,ticket,text,at}) {
  if(!/^[\w-]+$/.test(uid)||!/^[-\w]+$/.test(id)) throw Error('客服單代號無效。');
  const body=String(text||'').trim();
  if(!body||body.length>1500) throw Error('回覆請填寫 1 至 1500 字。');
  if(ticket.reply) throw Error('這筆客服單已回覆，請重新整理確認。');
  return {
    [`supportV1/tickets/${uid}/${id}/reply`]:{text:body,at},
    [`supportV1/inbox/${uid}/${id}`]:{title:'客服回覆｜'+ticket.subject,text:body,from:'店長客服',at,ticketId:id,question:ticket.text}
  };
}
