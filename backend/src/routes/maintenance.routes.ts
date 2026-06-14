import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
const db = prisma as any;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const ok = /jpeg|jpg|png|gif|webp/.test(file.mimetype); if (ok) { cb(null, true); } else { cb(new Error('Images only')); } } });

// POST /api/maintenance/records - Create maintenance record
router.post(
  '/records',
  authenticateToken,
  upload.single('receiptImage'),
  [
    body('title').notEmpty(),
    body('category').isIn(['ENGINE', 'TRANSMISSION', 'BRAKES', 'TIRES', 'ELECTRICAL', 'PLUMBING', 'APPLIANCES', 'HVAC', 'EXTERIOR', 'INTERIOR', 'SAFETY', 'GENERATOR', 'OTHER']),
    body('serviceDate').isISO8601(),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }


     const {
         title,
         category,
         description,
         cost,
         mileage,
         location,
         serviceDate,
         notes,
         createReminder,
         reminderFrequency,
         customMiles,
         customMonths,
         providerName,
         providerAddress,
         metadata,
         serviceItems,
         laborCost,
         shopName,
         technicianName,
         workOrderNumber,
         isBodyWork,
         warrantyExpires,
         } = req.body;


      const data: any = {
        userId: (req as any).userId,
        title,
        category,
        description: description || undefined,
        cost: cost ? parseFloat(cost) : undefined,
        mileage: mileage ? parseInt(mileage) : undefined,
        location: location || undefined,
        serviceDate: new Date(serviceDate),
        status: 'COMPLETED',
        notes: notes || undefined,
        providerName: providerName || shopName || undefined,
        providerAddress: providerAddress || undefined,
        metadata: metadata ? (typeof metadata === "string" ? JSON.parse(metadata) : metadata) : undefined,
        serviceItems: serviceItems ? (typeof serviceItems === 'string' ? JSON.parse(serviceItems) : serviceItems) : undefined,
        laborCost: laborCost ? parseFloat(laborCost) : undefined,
        shopName: shopName || providerName || undefined,
        technicianName: technicianName || undefined,
        workOrderNumber: workOrderNumber || undefined,
        isBodyWork: isBodyWork === 'true' || isBodyWork === true,
        warrantyExpires: warrantyExpires ? new Date(warrantyExpires) : undefined,
    };

      if (req.file) {
        data.receiptImage = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/maintenance');
      }

      const record = await db.maintenanceRecord.create({
        data,
      });

      // Create reminder if requested
      if (createReminder === 'true' && reminderFrequency) {
        const reminderData: any = {
          userId: (req as any).userId,
          maintenanceId: record.id,
          title: `${title} - Next Service`,
          category,
          description: `Reminder for ${title}`,
          frequency: reminderFrequency,
          isActive: true,
        };

        // Calculate next due date/mileage
        const serviceDate = new Date(record.serviceDate);
        
        switch (reminderFrequency) {
          case 'WEEKLY':
            reminderData.nextDueDate = new Date(serviceDate.setDate(serviceDate.getDate() + 7));
            break;
          case 'BI_WEEKLY':
            reminderData.nextDueDate = new Date(serviceDate.setDate(serviceDate.getDate() + 14));
            break;
          case 'MONTHLY':
            reminderData.nextDueDate = new Date(serviceDate.setMonth(serviceDate.getMonth() + 1));
            break;
          case 'QUARTERLY':
            reminderData.nextDueDate = new Date(serviceDate.setMonth(serviceDate.getMonth() + 3));
            break;
          case 'SEMI_ANNUALLY':
            reminderData.nextDueDate = new Date(serviceDate.setMonth(serviceDate.getMonth() + 6));
            break;
          case 'ANNUALLY':
            reminderData.nextDueDate = new Date(serviceDate.setFullYear(serviceDate.getFullYear() + 1));
            break;
          case 'CUSTOM_MONTHS':
            if (customMonths) {
              reminderData.customMonths = parseInt(customMonths);
              reminderData.nextDueDate = new Date(serviceDate.setMonth(serviceDate.getMonth() + parseInt(customMonths)));
            }
            break;
          case 'CUSTOM_MILES':
            if (customMiles && mileage) {
              reminderData.customMiles = parseInt(customMiles);
              reminderData.nextDueMileage = parseInt(mileage) + parseInt(customMiles);
            }
            break;
        }

        await db.maintenanceReminder.create({
          data: reminderData,
        });
      }

      res.json(record);
    } catch (error: any) {
      console.error('Create maintenance record error:', error);
      res.status(500).json({ error: 'Failed to create maintenance record' });
    }
  }
);

// GET /api/maintenance/records - Get user's maintenance records
router.get('/records', authenticateToken, async (req, res) => {
  try {
    const { category, status } = req.query;

    const whereClause: any = {
      userId: (req as any).userId,
    };

    if (category) {
      whereClause.category = category;
    }

    if (status) {
      whereClause.status = status;
    }

    const records = await db.maintenanceRecord.findMany({
      where: whereClause,
      include: {
        reminder: true,
      },
      orderBy: { serviceDate: 'desc' },
    });

    res.json(records);
  } catch (error: any) {
    console.error('Get maintenance records error:', error);
    res.status(500).json({ error: 'Failed to get maintenance records' });
  }
});

// GET /api/maintenance/records/:id - Get single maintenance record
router.get('/records/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const record = await db.maintenanceRecord.findUnique({
      where: { id },
      include: {
        reminder: true,
      },
    });

    if (!record) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    if (record.userId !== (req as any).userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(record);
  } catch (error: any) {
    console.error('Get maintenance record error:', error);
    res.status(500).json({ error: 'Failed to get maintenance record' });
  }
});

// PUT /api/maintenance/records/:id - Update maintenance record
router.put('/records/:id', authenticateToken, upload.single('receiptImage'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      category,
      description,
      cost,
      mileage,
      location,
      serviceDate,
      status,
      notes,
      providerName,
      providerAddress,
      metadata,
    } = req.body;

    const record = await db.maintenanceRecord.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    if (record.userId !== (req as any).userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }




const updateData: any = {
  title,
  category,
  description: description || undefined,
  cost: cost ? parseFloat(cost) : undefined,
  mileage: mileage ? parseInt(mileage) : undefined,
  location: location || undefined,
  serviceDate: serviceDate ? new Date(serviceDate) : undefined,
  status: status || undefined,
  notes: notes || undefined,
  providerName: providerName || undefined,
  providerAddress: providerAddress || undefined,
  metadata: metadata ? (typeof metadata === "string" ? JSON.parse(metadata) : metadata) : undefined,

};


    if (req.file) {
      updateData.receiptImage = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/maintenance');
    }

    const updated = await db.maintenanceRecord.update({
      where: { id },
      data: updateData,
      include: {
        reminder: true,
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Update maintenance record error:', error);
    res.status(500).json({ error: 'Failed to update maintenance record' });
  }
});

// DELETE /api/maintenance/records/:id - Delete maintenance record
router.delete('/records/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const record = await db.maintenanceRecord.findUnique({
      where: { id },
    });

    if (!record) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    if (record.userId !== (req as any).userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.maintenanceRecord.delete({
      where: { id },
    });

    res.json({ message: 'Maintenance record deleted' });
  } catch (error: any) {
    console.error('Delete maintenance record error:', error);
    res.status(500).json({ error: 'Failed to delete maintenance record' });
  }
});

// POST /api/maintenance/reminders - Create maintenance reminder
router.post(
  '/reminders',
  authenticateToken,
  [
    body('title').notEmpty(),
    body('category').isIn(['ENGINE', 'TRANSMISSION', 'BRAKES', 'TIRES', 'ELECTRICAL', 'PLUMBING', 'APPLIANCES', 'HVAC', 'EXTERIOR', 'INTERIOR', 'SAFETY', 'GENERATOR', 'OTHER']),
    body('frequency').isIn(['ONCE', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY', 'CUSTOM_MILES', 'CUSTOM_MONTHS']),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        category,
        description,
        frequency,
        customMiles,
        customMonths,
        nextDueDate,
        nextDueMileage,
      } = req.body;

      const data: any = {
        userId: (req as any).userId,
        title,
        category,
        description: description || undefined,
        frequency,
        customMiles: customMiles ? parseInt(customMiles) : undefined,
        customMonths: customMonths ? parseInt(customMonths) : undefined,
        nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined,
        nextDueMileage: nextDueMileage ? parseInt(nextDueMileage) : undefined,
        isActive: true,
      };

      const reminder = await db.maintenanceReminder.create({
        data,
      });

      res.json(reminder);
    } catch (error: any) {
      console.error('Create maintenance reminder error:', error);
      res.status(500).json({ error: 'Failed to create maintenance reminder' });
    }
  }
);

// GET /api/maintenance/reminders - Get user's maintenance reminders
router.get('/reminders', authenticateToken, async (req, res) => {
  try {
    const { active } = req.query;

    const whereClause: any = {
      userId: (req as any).userId,
    };

    if (active === 'true') {
      whereClause.isActive = true;
    }

    const reminders = await db.maintenanceReminder.findMany({
      where: whereClause,
      include: {
        maintenanceRecord: true,
      },
      orderBy: { nextDueDate: 'asc' },
    });

    res.json(reminders);
  } catch (error: any) {
    console.error('Get maintenance reminders error:', error);
    res.status(500).json({ error: 'Failed to get maintenance reminders' });
  }
});

// GET /api/maintenance/reminders/upcoming - Get upcoming reminders
router.get('/reminders/upcoming', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const reminders = await db.maintenanceReminder.findMany({
      where: {
        userId: (req as any).userId,
        isActive: true,
        nextDueDate: {
          gte: today,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        maintenanceRecord: true,
      },
      orderBy: { nextDueDate: 'asc' },
    });

    res.json(reminders);
  } catch (error: any) {
    console.error('Get upcoming reminders error:', error);
    res.status(500).json({ error: 'Failed to get upcoming reminders' });
  }
});

// PUT /api/maintenance/reminders/:id - Update maintenance reminder
router.put('/reminders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      category,
      description,
      frequency,
      customMiles,
      customMonths,
      nextDueDate,
      nextDueMileage,
      isActive,
    } = req.body;

    const reminder = await db.maintenanceReminder.findUnique({
      where: { id },
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (reminder.userId !== (req as any).userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updateData: any = {
      title,
      category,
      description: description || undefined,
      frequency,
      customMiles: customMiles ? parseInt(customMiles) : undefined,
      customMonths: customMonths ? parseInt(customMonths) : undefined,
      nextDueDate: nextDueDate ? new Date(nextDueDate) : undefined,
      nextDueMileage: nextDueMileage ? parseInt(nextDueMileage) : undefined,
      isActive: isActive !== undefined ? isActive : undefined,
    };

    const updated = await db.maintenanceReminder.update({
      where: { id },
      data: updateData,
      include: {
        maintenanceRecord: true,
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Update maintenance reminder error:', error);
    res.status(500).json({ error: 'Failed to update maintenance reminder' });
  }
});

// DELETE /api/maintenance/reminders/:id - Delete maintenance reminder
router.delete('/reminders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const reminder = await db.maintenanceReminder.findUnique({
      where: { id },
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (reminder.userId !== (req as any).userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.maintenanceReminder.delete({
      where: { id },
    });

    res.json({ message: 'Reminder deleted' });
  } catch (error: any) {
    console.error('Delete maintenance reminder error:', error);
    res.status(500).json({ error: 'Failed to delete maintenance reminder' });
  }
});

// GET /api/maintenance/stats - Get maintenance statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const records = await db.maintenanceRecord.findMany({
      where: { userId: (req as any).userId },
    });

    const totalSpent = records.reduce((sum: any, record: any) => sum + (record.cost || 0), 0);
    const recordsByCategory = records.reduce((acc: any, record: any) => {
      acc[record.category] = (acc[record.category] || 0) + 1;
      return acc;
    }, {});

    const activeReminders = await db.maintenanceReminder.count({
      where: {
        userId: (req as any).userId,
        isActive: true,
      },
    });

    const today = new Date();
    const overdueReminders = await db.maintenanceReminder.count({
      where: {
        userId: (req as any).userId,
        isActive: true,
        nextDueDate: {
          lt: today,
        },
      },
    });

    res.json({
      totalRecords: records.length,
      totalSpent,
      recordsByCategory,
      activeReminders,
      overdueReminders,
    });
  } catch (error: any) {
    console.error('Get maintenance stats error:', error);
    res.status(500).json({ error: 'Failed to get maintenance stats' });
  }
});

export default router;
