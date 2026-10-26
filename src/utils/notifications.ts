import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { formatCurrency } from './format';

// Configure foreground presentation behavior (Expo SDK 57 compliant)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_INVOICES = 'mezo_invoices';
const CHANNEL_REMINDERS = 'mezo_reminders';

const DAILY_REMINDER_ID = 'mezo_daily_review';
const WEEKLY_REMINDER_ID = 'mezo_weekly_review';

export const notificationService = {
  /**
   * Initializes notification channels, requests permissions, and schedules daily/weekly reminders.
   */
  async init(): Promise<boolean> {
    try {
      // 1. Android Notification Channels
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_INVOICES, {
          name: 'فواتير وعمليات ميزو ستور',
          description: 'إشعارات إضافة وتعديل وحذف وطباعة وتصدير الفواتير',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#A9833F',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
          name: 'تذكيرات وتقارير ميزو ستور',
          description: 'تذكيرات يومية وأسبوعية لمراجعة تقارير المبيعات والمشتريات',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#A9833F',
          sound: 'default',
        });
      }

      // 2. Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      // 3. Schedule Recurring Reminders (Daily & Weekly)
      await this.scheduleRecurringReminders();
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Schedules or re-schedules the end-of-day and weekly review notifications.
   */
  async scheduleRecurringReminders(): Promise<void> {
    try {
      // Cancel previous scheduled reminders to prevent duplicates
      await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
      await Notifications.cancelScheduledNotificationAsync(WEEKLY_REMINDER_ID).catch(() => {});

      // 1. Daily Notification at 22:00 (10:00 PM)
      await Notifications.scheduleNotificationAsync({
        identifier: DAILY_REMINDER_ID,
        content: {
          title: 'ميزو ستور • تقرير نهاية اليوم 📊',
          body: 'انتهى يوم العمل! حان وقت مراجعة ملخص مبيعات ومشتريات اليوم وتدقيق الحسابات والأرباح.',
          sound: 'default',
          data: { screen: 'reports' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 22,
          minute: 0,
          channelId: CHANNEL_REMINDERS,
        },
      });

      // 2. Weekly Notification on Friday at 21:00 (9:00 PM) (weekday 6 = Friday)
      await Notifications.scheduleNotificationAsync({
        identifier: WEEKLY_REMINDER_ID,
        content: {
          title: 'ميزو ستور • الحصاد الأسبوعي 📈',
          body: 'حان موعد الجرد الأسبوعي! تفقد إجمالي مبيعات ومشتريات الأسبوع لمتابعة أداء المتجر والسيولة.',
          sound: 'default',
          data: { screen: 'reports' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: 6,
          hour: 21,
          minute: 0,
          channelId: CHANNEL_REMINDERS,
        },
      });
    } catch {
      // Silently catch scheduling issues if background permission is restricted
    }
  },

  /**
   * Dispatches an immediate local notification with app branding.
   */
  async sendLocalNotification(options: {
    title: string;
    body: string;
    channelId?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          sound: 'default',
          data: options.data,
        },
        trigger: null, // deliver immediately
      });
    } catch {
      // Non-blocking notification dispatch
    }
  },

  /**
   * Trigger: Invoice Created
   */
  async notifyInvoiceCreated(invoice: {
    id: string;
    number: string;
    kind: 'sale' | 'purchase';
    total: number;
    device_type: string;
  }): Promise<void> {
    const isSale = invoice.kind === 'sale';
    const title = isSale
      ? 'ميزو ستور • فاتورة بيع جديدة 🧾'
      : 'ميزو ستور • فاتورة شراء جديدة 📦';

    const body = isSale
      ? `تم إصدار فاتورة بيع رقم ${invoice.number} بمبلغ ${formatCurrency(invoice.total)} (${invoice.device_type}).`
      : `تم تسجيل فاتورة شراء رقم ${invoice.number} بمبلغ ${formatCurrency(invoice.total)} (${invoice.device_type}).`;

    await this.sendLocalNotification({
      title,
      body,
      channelId: CHANNEL_INVOICES,
      data: { invoiceId: invoice.id },
    });
  },

  /**
   * Trigger: Invoice Updated / Edited
   */
  async notifyInvoiceUpdated(invoiceNumber: string, invoiceId?: string): Promise<void> {
    await this.sendLocalNotification({
      title: 'ميزو ستور • تم تعديل الفاتورة ✏️',
      body: `تم حفظ التعديلات الجديدة على الفاتورة رقم ${invoiceNumber} بنجاح.`,
      channelId: CHANNEL_INVOICES,
      data: invoiceId ? { invoiceId } : undefined,
    });
  },

  /**
   * Trigger: Invoice Cancelled
   */
  async notifyInvoiceCancelled(invoiceNumber: string, invoiceId?: string): Promise<void> {
    await this.sendLocalNotification({
      title: 'ميزو ستور • تم إلغاء الفاتورة ⚠️',
      body: `تم إلغاء الفاتورة رقم ${invoiceNumber} وإيقاف احتسابها في إحصائيات المتجر.`,
      channelId: CHANNEL_INVOICES,
      data: invoiceId ? { invoiceId } : undefined,
    });
  },

  /**
   * Trigger: Invoice Deleted
   */
  async notifyInvoiceDeleted(invoiceNumber: string): Promise<void> {
    await this.sendLocalNotification({
      title: 'ميزو ستور • تم حذف الفاتورة 🗑️',
      body: `تم حذف فاتورة الشراء رقم ${invoiceNumber} نهائياً من السجل.`,
      channelId: CHANNEL_INVOICES,
    });
  },

  /**
   * Trigger: Invoice Exported (PDF)
   */
  async notifyInvoiceExported(invoiceNumber: string, invoiceId?: string): Promise<void> {
    await this.sendLocalNotification({
      title: 'ميزو ستور • تصدير الفاتورة 📄',
      body: `تم تجهيز وتصدير ملف PDF للفاتورة رقم ${invoiceNumber} بنجاح وهو جاهز للمشاركة.`,
      channelId: CHANNEL_INVOICES,
      data: invoiceId ? { invoiceId } : undefined,
    });
  },

  /**
   * Trigger: Invoice Printed
   */
  async notifyInvoicePrinted(invoiceNumber: string, invoiceId?: string): Promise<void> {
    await this.sendLocalNotification({
      title: 'ميزو ستور • طباعة الفاتورة 🖨️',
      body: `تم إرسال أمر طباعة الفاتورة رقم ${invoiceNumber} بنجاح إلى الطابعة.`,
      channelId: CHANNEL_INVOICES,
      data: invoiceId ? { invoiceId } : undefined,
    });
  },

  /**
   * Test Notification for settings screen
   */
  async sendTestNotification(): Promise<void> {
    await this.sendLocalNotification({
      title: 'ميزو ستور • إشعار تجريبي 🔔',
      body: 'نظام الإشعارات المحلية يعمل بنجاح ومضبوط على هوية متجر ميزو ستور.',
      channelId: CHANNEL_INVOICES,
    });
  },
};
