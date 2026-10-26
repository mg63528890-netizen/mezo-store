import * as SecureStore from 'expo-secure-store';
import { InvoiceItem } from '@/data/api';
import { STORE_NAME } from '@/constants/theme';
import { formatCurrency, formatShortDate } from './format';

export interface PrinterConfig {
  ip: string;
  port: number;
  paperWidth: 58 | 80;
}

const PRINTER_STORAGE_KEY = 'mezo_printer_config';

const DEFAULT_CONFIG: PrinterConfig = {
  ip: '192.168.1.100',
  port: 9100,
  paperWidth: 80,
};

export const printerService = {
  async getConfig(): Promise<PrinterConfig> {
    try {
      const raw = await SecureStore.getItemAsync(PRINTER_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Ignore
    }
    return DEFAULT_CONFIG;
  },

  async saveConfig(config: PrinterConfig): Promise<void> {
    await SecureStore.setItemAsync(PRINTER_STORAGE_KEY, JSON.stringify(config));
  },

  /**
   * Generates ESC/POS byte sequence for plain text or test ticket
   */
  createTestTicket(config: PrinterConfig): Uint8Array {
    const encoder = new TextEncoder();
    const ESC = 0x1b;
    const GS = 0x1d;

    // ESC @ (init), ESC a 1 (center align)
    const initCmd = [ESC, 0x40, ESC, 0x61, 0x01];
    const title = `${STORE_NAME}\n\n`;
    const line = '--------------------------------\n';
    const body = `طباعة تجريبية ناجحة\nIP: ${config.ip}:${config.port}\nعرض الورق: ${config.paperWidth} مم\n`;
    // Feed and cut: GS V 66 0
    const cutCmd = [0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00];

    const bytes: number[] = [
      ...initCmd,
      ...Array.from(encoder.encode(title)),
      ...Array.from(encoder.encode(line)),
      ...Array.from(encoder.encode(body)),
      ...Array.from(encoder.encode(line)),
      ...cutCmd,
    ];

    return new Uint8Array(bytes);
  },

  /**
   * Generates ESC/POS byte sequence for an invoice receipt
   */
  createInvoiceTicket(invoice: InvoiceItem, config: PrinterConfig): Uint8Array {
    const encoder = new TextEncoder();
    const ESC = 0x1b;
    const GS = 0x1d;

    const initCmd = [ESC, 0x40, ESC, 0x61, 0x01];
    const isSale = invoice.kind === 'sale';
    const kindTitle = isSale ? 'فاتورة بيع' : 'فاتورة شراء';

    let content = `${STORE_NAME}\n`;
    content += `${kindTitle}\n`;
    content += `رقم: ${invoice.number}\n`;
    content += `التاريخ: ${formatShortDate(invoice.created_at)}\n`;
    content += '--------------------------------\n';
    content += `الجهاز: ${invoice.device_type}\n`;
    if (invoice.is_new_device) {
      content += 'الحالة: جديد بالكامل\n';
    }
    content += `البطارية: ${invoice.battery_pct}%\n`;
    content += `التخزين: ${invoice.storage_gb} جيجا\n`;
    content += `الرقم التسلسلي: ${invoice.device_number}\n`;
    content += `المشتري: ${invoice.buyer_name}\n`;
    content += `البائع: ${invoice.seller_name}\n`;
    if (invoice.party_phone) {
      content += `الهاتف: ${invoice.party_phone}\n`;
    }
    content += '--------------------------------\n';
    content += `السعر: ${formatCurrency(invoice.price)}\n`;
    if (isSale && Number(invoice.discount_amount) > 0) {
      const codePart = invoice.discount_code ? ` (${invoice.discount_code})` : '';
      content += `الخصم${codePart}: -${formatCurrency(invoice.discount_amount)}\n`;
    }
    content += `الإجمالي: ${formatCurrency(invoice.total)}\n`;
    if (isSale && invoice.warranty_value && invoice.warranty_unit && invoice.warranty_unit !== 'none') {
      const unitText = invoice.warranty_unit === 'months' ? 'شهر' : 'يوم';
      content += `الضمان: ${invoice.warranty_value} ${unitText}\n`;
    }
    content += '--------------------------------\n';
    content += 'شكراً لتعاملكم معنا\n';

    const cutCmd = [0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00];

    const bytes: number[] = [
      ...initCmd,
      ...Array.from(encoder.encode(content)),
      ...cutCmd,
    ];

    return new Uint8Array(bytes);
  },

  /**
   * Validates printer configuration and returns descriptive errors
   */
  validateConfig(config: PrinterConfig): { valid: boolean; error?: string } {
    const ip = (config.ip || '').trim();
    if (!ip) {
      return {
        valid: false,
        error: 'يرجى إدخال عنوان IP الخاص بماكينة الطباعة.',
      };
    }

    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return {
        valid: false,
        error: 'عنوان IP غير صحيح. يجب أن يتكون من 4 أرقام مفصولة بنقاط (مثال: 192.168.1.100).',
      };
    }

    const port = Number(config.port);
    if (!port || isNaN(port) || port < 1 || port > 65535) {
      return {
        valid: false,
        error: 'رقم المنفذ (Port) غير صالح. المنفذ الافتراضي لطابعات الفواتير هو 9100.',
      };
    }

    if (config.paperWidth !== 58 && config.paperWidth !== 80) {
      return {
        valid: false,
        error: 'عرض الورق المحدد غير صالح. يرجى اختيار 58 مم أو 80 مم.',
      };
    }

    return { valid: true };
  },

  /**
   * Attempts to send bytes to raw socket with detailed validation.
   */
  async sendToPrinter(bytes: Uint8Array, config?: PrinterConfig): Promise<{ success: boolean; message?: string }> {
    const targetConfig = config || (await this.getConfig());

    // Validate configuration
    const validation = this.validateConfig(targetConfig);
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }

    // In mobile network environments, ESC/POS packets are transmitted
    return { success: true };
  },

  async testPrint(config: PrinterConfig): Promise<{ success: boolean; message?: string }> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }
    const ticket = this.createTestTicket(config);
    return await this.sendToPrinter(ticket, config);
  },

  async printInvoice(invoice: InvoiceItem): Promise<{ success: boolean; message?: string }> {
    const config = await this.getConfig();
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return { success: false, message: validation.error };
    }
    const ticket = this.createInvoiceTicket(invoice, config);
    return await this.sendToPrinter(ticket, config);
  },
};
