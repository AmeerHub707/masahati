// أداة تصدير CSV مشتركة بين صفحات لوحة التحكم (المستخدمون، التقارير المالية).
//
// BOM في بداية الملف ضروري: بدونه يفكّ Microsoft Excel ترميز UTF-8 على أنه
// صفحة الترميز المحلية ويظهر النص العربي كحروف مشوّهة (mojibake).
const BOM = '\uFEFF';

// يهرّب كل خلية: يلفّها بعلامتَي اقتباس ويضاعف أي اقتباس داخلي —
// ضروري لأن أسماء Spaces/المستخدمين والحقول قد تحتوي فواصل أو أسطر جديدة.
function cell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

// rows: مصفوفة من المصفوفات (الصف الأول هو العناوين). \r\n هو فاصل الأسطر
// الذي يتوقّعه Excel، بخلاف \n الذي يدمج الصفوف في خلية واحدة.
export function buildCsv(rows) {
  return BOM + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

export function downloadCsv(filename, rows) {
  const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
