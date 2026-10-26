import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { InvoiceItem } from '@/data/api';
import { STORE_NAME } from '@/constants/theme';
import { formatCurrency, formatShortDate } from './format';

export function buildInvoiceHtml(invoice: InvoiceItem, lang: 'ar' | 'en' = 'ar'): string {
  const isSale = invoice.kind === 'sale';
  const isAr = lang === 'ar';

  const kindLabel = isSale
    ? isAr ? 'فاتورة بيع' : 'Sale Invoice'
    : isAr ? 'فاتورة شراء' : 'Purchase Invoice';

  const newDeviceBadge = invoice.is_new_device
    ? `<span style="background-color: #4F8A62; color: #fff; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; margin-inline-start: 8px;">${
        isAr ? 'جديد بالكامل' : 'Brand New'
      }</span>`
    : '';

  const warrantyText =
    isSale && invoice.warranty_value && invoice.warranty_unit && invoice.warranty_unit !== 'none'
      ? `${invoice.warranty_value} ${
          invoice.warranty_unit === 'months'
            ? isAr ? 'أشهر' : 'Months'
            : isAr ? 'أيام' : 'Days'
        }`
      : isAr ? 'بدون ضمان' : 'No Warranty';

  return `
    <!DOCTYPE html>
    <html lang="${lang}" dir="${isAr ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="utf-8" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Inter:wght@400;600;700&display=swap');
        
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: ${isAr ? "'Tajawal', sans-serif" : "'Inter', sans-serif"};
          background: #ffffff;
          color: #2A2D33;
          padding: 40px;
          line-height: 1.6;
          font-size: 14px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #E4E6EA;
          padding-bottom: 24px;
          margin-bottom: 28px;
        }

        .store-title {
          font-size: 22px;
          font-weight: 800;
          color: #2A2D33;
        }

        .invoice-type {
          font-size: 18px;
          font-weight: 700;
          color: #A9833F;
          margin-top: 4px;
        }

        .meta-side {
          text-align: ${isAr ? 'left' : 'right'};
        }

        .meta-line {
          font-size: 13px;
          color: #7A7F88;
        }

        .meta-val {
          font-weight: 700;
          color: #2A2D33;
        }

        .section-box {
          background: #F8F9FA;
          border: 1px solid #E9EBEF;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .section-title {
          font-size: 15px;
          font-weight: 700;
          color: #A9833F;
          margin-bottom: 14px;
          border-bottom: 1px solid #E9EBEF;
          padding-bottom: 6px;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
        }

        .field-label {
          font-size: 12px;
          color: #7A7F88;
          font-weight: 500;
        }

        .field-value {
          font-size: 14px;
          color: #2A2D33;
          font-weight: 700;
          margin-top: 2px;
        }

        .summary-box {
          background: #FDFBF7;
          border: 1px solid #EEDBB2;
          border-radius: 12px;
          padding: 20px;
          margin-top: 24px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
        }

        .summary-total {
          border-top: 2px solid #D4B87A;
          margin-top: 10px;
          padding-top: 10px;
          font-size: 18px;
          font-weight: 800;
          color: #A9833F;
        }

        .footer {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-top: 20px;
        }

        .stamp-area {
          text-align: center;
          width: 150px;
          height: 90px;
          border: 1px dashed #BEC2C9;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #BEC2C9;
          font-size: 12px;
        }

        .signature-area {
          text-align: center;
          width: 150px;
          border-top: 1px solid #2A2D33;
          padding-top: 6px;
          font-weight: 700;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="store-title">${STORE_NAME}</div>
          <div class="invoice-type">${kindLabel} ${newDeviceBadge}</div>
        </div>
        <div class="meta-side">
          <div class="meta-line">${isAr ? 'رقم الفاتورة' : 'Invoice #'}: <span class="meta-val">${invoice.number}</span></div>
          <div class="meta-line">${isAr ? 'التاريخ' : 'Date'}: <span class="meta-val">${formatShortDate(invoice.created_at)}</span></div>
        </div>
      </div>

      <!-- Device Details -->
      <div class="section-box">
        <div class="section-title">${isAr ? 'بيانات الجهاز' : 'Device Specifications'}</div>
        <div class="grid-2">
          <div class="field-group">
            <span class="field-label">${isAr ? 'نوع الجهاز' : 'Device Type'}</span>
            <span class="field-value">${invoice.device_type}</span>
          </div>
          <div class="field-group">
            <span class="field-label">${isAr ? 'الرقم التسلسلي / IMEI' : 'Serial / IMEI'}</span>
            <span class="field-value">${invoice.device_number}</span>
          </div>
          <div class="field-group">
            <span class="field-label">${isAr ? 'نسبة البطارية' : 'Battery Health'}</span>
            <span class="field-value">${invoice.battery_pct}%</span>
          </div>
          <div class="field-group">
            <span class="field-label">${isAr ? 'مساحة التخزين' : 'Storage'}</span>
            <span class="field-value">${invoice.storage_gb} GB</span>
          </div>
          <div class="field-group">
            <span class="field-label">${isAr ? 'مدة الضريبة' : 'Tax Period'}</span>
            <span class="field-value">${invoice.tax_period}</span>
          </div>
          ${
            isSale
              ? `<div class="field-group">
                  <span class="field-label">${isAr ? 'مدة الضمان' : 'Warranty'}</span>
                  <span class="field-value">${warrantyText}</span>
                </div>`
              : ''
          }
        </div>
        ${
          invoice.condition_notes
            ? `<div class="field-group" style="margin-top: 14px;">
                <span class="field-label">${isAr ? 'حالة وملاحظات الجهاز' : 'Condition & Notes'}</span>
                <span class="field-value">${invoice.condition_notes}</span>
              </div>`
            : ''
        }
      </div>

      <!-- Parties Details -->
      <div class="section-box">
        <div class="section-title">${isAr ? 'بيانات الأطراف' : 'Parties'}</div>
        <div class="grid-2">
          <div class="field-group">
            <span class="field-label">${isAr ? 'اسم المشتري' : 'Buyer'}</span>
            <span class="field-value">${invoice.buyer_name}</span>
          </div>
          <div class="field-group">
            <span class="field-label">${isAr ? 'اسم البائع' : 'Seller'}</span>
            <span class="field-value">${invoice.seller_name}</span>
          </div>
          ${
            invoice.party_phone
              ? `<div class="field-group">
                  <span class="field-label">${
                    isSale
                      ? isAr ? 'رقم تليفون المشتري' : 'Buyer Phone'
                      : isAr ? 'رقم تليفون البائع' : 'Seller Phone'
                  }</span>
                  <span class="field-value">${invoice.party_phone}</span>
                </div>`
              : ''
          }
        </div>
      </div>

      <!-- Financial Summary -->
      <div class="summary-box">
        <div class="summary-row">
          <span>${isAr ? 'السعر' : 'Price'}</span>
          <span>${formatCurrency(invoice.price, lang)}</span>
        </div>
        ${
          isSale && Number(invoice.discount_amount) > 0
            ? `<div class="summary-row" style="color: #B5533F;">
                <span>${isAr ? 'الخصم' : 'Discount'}${invoice.discount_code ? ` (${invoice.discount_code})` : ''}</span>
                <span>-${formatCurrency(invoice.discount_amount, lang)}</span>
              </div>`
            : ''
        }
        <div class="summary-row summary-total">
          <span>${isAr ? 'المجموع الإجمالي' : 'Total Amount'}</span>
          <span>${formatCurrency(invoice.total, lang)}</span>
        </div>
      </div>

      <!-- Footer Stamp & Signature -->
      <div class="footer">
        <div class="stamp-area">
          ${isAr ? 'ختم المحل' : 'Official Stamp'}
        </div>
        <div class="signature-area">
          ${isAr ? 'توقيع المستلم' : 'Authorized Signature'}
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function exportInvoicePdf(invoice: InvoiceItem, lang: 'ar' | 'en' = 'ar'): Promise<void> {
  const html = buildInvoiceHtml(invoice, lang);

  // 1. Generate PDF file
  const { uri } = await Print.printToFileAsync({ html });

  // 2. Rename to strict filename: Mezo-<invoice-number>.pdf (§9.3)
  const cleanNumber = invoice.number.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetUri = `${FileSystem.cacheDirectory}Mezo-${cleanNumber}.pdf`;

  await FileSystem.copyAsync({
    from: uri,
    to: targetUri,
  });

  // 3. Share
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(targetUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Mezo-${cleanNumber}.pdf`,
      UTI: 'com.adobe.pdf',
    });
  }
}

/**
 * Direct native printing via AirPrint (iOS) or Android Print Service
 */
export async function printInvoiceDirect(invoice: InvoiceItem, lang: 'ar' | 'en' = 'ar'): Promise<void> {
  const html = buildInvoiceHtml(invoice, lang);
  await Print.printAsync({ html });
}
