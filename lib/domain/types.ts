import { z } from 'zod';

/** ISO date string (YYYY-MM-DD). Times are not needed for vehicle records. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const vehicleSchema = z.object({
  id: z.string(),
  nickname: z.string().min(1, 'Give it a name'),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number().int().min(1900).max(2100),
  trim: z.string().nullable(),
  vin: z.string().nullable(),
  licensePlate: z.string().nullable(),
  mileage: z.number().int().min(0),
  purchaseDate: isoDate.nullable(),
  purchasePrice: z.number().min(0).nullable(),
  photoUri: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Vehicle = z.infer<typeof vehicleSchema>;

export const serviceRecordSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  serviceType: z.string().min(1),
  date: isoDate,
  mileage: z.number().int().min(0).nullable(),
  cost: z.number().min(0).nullable(),
  shopName: z.string().nullable(),
  notes: z.string().nullable(),
  receiptUri: z.string().nullable(),
  nextDueDate: isoDate.nullable(),
  nextDueMileage: z.number().int().min(0).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ServiceRecord = z.infer<typeof serviceRecordSchema>;

export const recurrenceTypes = ['none', 'date', 'mileage', 'both'] as const;
export type RecurrenceType = (typeof recurrenceTypes)[number];

export const reminderStatuses = ['active', 'completed'] as const;
export type ReminderStatus = (typeof reminderStatuses)[number];

export const reminderSchema = z.object({
  id: z.string(),
  vehicleId: z.string(),
  title: z.string().min(1, 'Title is required'),
  category: z.string(),
  dueDate: isoDate.nullable(),
  dueMileage: z.number().int().min(0).nullable(),
  recurrenceType: z.enum(recurrenceTypes),
  recurrenceIntervalMonths: z.number().int().min(1).nullable(),
  recurrenceIntervalMiles: z.number().int().min(1).nullable(),
  status: z.enum(reminderStatuses),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Reminder = z.infer<typeof reminderSchema>;

export type NewVehicle = Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>;
export type NewServiceRecord = Omit<ServiceRecord, 'id' | 'createdAt' | 'updatedAt'>;
export type NewReminder = Omit<Reminder, 'id' | 'status' | 'completedAt' | 'createdAt' | 'updatedAt'>;
