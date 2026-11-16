/** Adiciona meses sem rolar 31/01 para março. Mantém a data local. */
export function addMonthsClamped(from=new Date(),months=1){
  const d=new Date(from),day=d.getDate();
  d.setDate(1);d.setMonth(d.getMonth()+months);
  d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
