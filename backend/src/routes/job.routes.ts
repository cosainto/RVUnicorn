import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { uploadBufferToCloudinary } from '../utils/cloudinary';
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();
const db = prisma as any;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const ok = /jpeg|jpg|png|gif|webp/.test(file.mimetype); if (ok) { cb(null, true); } else { cb(new Error('Images only')); } } });

// POST /api/jobs/postings - Create job posting (campground admin only)
router.post(
  '/postings',
  authenticateToken,
  [
    body('campgroundId').notEmpty(),
    body('title').notEmpty(),
    body('description').notEmpty(),
    body('category').isIn(['FRONT_DESK', 'MAINTENANCE', 'HOUSEKEEPING', 'GROUNDSKEEPING', 'ACTIVITIES', 'RETAIL', 'FOOD_SERVICE', 'SECURITY', 'MANAGEMENT', 'OTHER']),
    body('jobType').isIn(['FULL_TIME', 'PART_TIME', 'SEASONAL', 'VOLUNTEER', 'WORKAMPING']),
    body('contactEmail').isEmail(),
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { campgroundId } = req.body;

      // Verify user is campground admin
      const campground = await db.campground.findUnique({
        where: { id: campgroundId },
        include: { admins: true },
      });

      if (!campground) {
        return res.status(404).json({ error: 'Campground not found' });
      }

      const isAdmin = campground.admins.some((admin: any) => admin.userId === (req as any).user!.id);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Not authorized to post jobs for this campground' });
      }

      const {
        title,
        description,
        category,
        jobType,
        startDate,
        endDate,
        hoursPerWeek,
        payRate,
        payType,
        housingProvided,
        housingDetails,
        rvSiteProvided,
        rvSiteDetails,
        utilitiesIncluded,
        mealsIncluded,
        requirements,
        benefits,
        duties,
        contactEmail,
        contactPhone,
        expiresAt,
      } = req.body;

      const jobPosting = await (db.jobPosting as any).create({
        data: {
          campgroundId,
          title,
          description,
          category,
          jobType,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          hoursPerWeek: hoursPerWeek ? parseInt(hoursPerWeek) : undefined,
          payRate: payRate ? parseFloat(payRate) : undefined,
          payType: payType || undefined,
          housingProvided: housingProvided === 'true' || housingProvided === true,
          housingDetails: housingDetails || undefined,
          rvSiteProvided: rvSiteProvided === 'true' || rvSiteProvided === true,
          rvSiteDetails: rvSiteDetails || undefined,
          utilitiesIncluded: utilitiesIncluded === 'true' || utilitiesIncluded === true,
          mealsIncluded: mealsIncluded === 'true' || mealsIncluded === true,
          requirements: requirements ? (Array.isArray(requirements) ? requirements : JSON.parse(requirements)) : [],
          benefits: benefits ? (Array.isArray(benefits) ? benefits : JSON.parse(benefits)) : [],
          duties: duties ? (Array.isArray(duties) ? duties : JSON.parse(duties)) : [],
          contactEmail,
          contactPhone: contactPhone || undefined,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
          isActive: true,
        },
        include: {
          campground: {
            select: {
              id: true,
              name: true,
              location: true,
              imageUrl: true,
            },
          },
        },
      });

      res.json(jobPosting);
    } catch (error: any) {
      console.error('Create job posting error:', error);
      res.status(500).json({ error: 'Failed to create job posting' });
    }
  }
);

// GET /api/jobs/postings - Get all active job postings
router.get('/postings', async (req, res) => {
  try {
    const { category, jobType, campgroundId, housingProvided, rvSiteProvided } = req.query;

    const whereClause: any = {
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    };

    if (category) {
      whereClause.category = category;
    }

    if (jobType) {
      whereClause.jobType = jobType;
    }

    if (campgroundId) {
      whereClause.campgroundId = campgroundId;
    }

    if (housingProvided === 'true') {
      whereClause.housingProvided = true;
    }

    if (rvSiteProvided === 'true') {
      whereClause.rvSiteProvided = true;
    }

    const jobPostings = await (db.jobPosting as any).findMany({
      where: whereClause,
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            imageUrl: true,
            slug: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(jobPostings);
  } catch (error: any) {
    console.error('Get job postings error:', error);
    res.status(500).json({ error: 'Failed to get job postings' });
  }
});

// GET /api/jobs/postings/:id - Get single job posting
router.get('/postings/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const jobPosting = await db.jobPosting.findUnique({
      where: { id },
      include: {
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            description: true,
            imageUrl: true,
            slug: true,
            amenities: true,
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    if (!jobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }

    res.json(jobPosting);
  } catch (error: any) {
    console.error('Get job posting error:', error);
    res.status(500).json({ error: 'Failed to get job posting' });
  }
});

// PUT /api/jobs/postings/:id - Update job posting
router.put('/postings/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const jobPosting = await db.jobPosting.findUnique({
      where: { id },
      include: {
        campground: {
          include: { admins: true },
        },
      },
    });

    if (!jobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }

    const isAdmin = jobPosting.campground.admins.some((admin: any) => admin.userId === (req as any).user!.id);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await db.jobPosting.update({
      where: { id },
      data: {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      },
      include: {
        campground: true,
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Update job posting error:', error);
    res.status(500).json({ error: 'Failed to update job posting' });
  }
});

// DELETE /api/jobs/postings/:id - Delete job posting
router.delete('/postings/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const jobPosting = await db.jobPosting.findUnique({
      where: { id },
      include: {
        campground: {
          include: { admins: true },
        },
      },
    });

    if (!jobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }

    const isAdmin = jobPosting.campground.admins.some((admin: any) => admin.userId === (req as any).user!.id);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await db.jobPosting.delete({
      where: { id },
    });

    res.json({ message: 'Job posting deleted' });
  } catch (error: any) {
    console.error('Delete job posting error:', error);
    res.status(500).json({ error: 'Failed to delete job posting' });
  }
});

// POST /api/jobs/apply - Apply for a job
router.post(
  '/apply',
  authenticateToken,
  upload.single('resume'),
  async (req, res) => {
    try {
      const { jobId, coverLetter, yearsExperience, availability } = req.body;

      // Check if already applied
      const existing = await db.jobApplication.findUnique({
        where: {
          jobId_userId: {
            jobId,
            userId: (req as any).user!.id,
          },
        },
      });

      if (existing) {
        return res.status(400).json({ error: 'Already applied to this job' });
      }

      const data: any = {
        jobId,
        userId: (req as any).user!.id,
        coverLetter: coverLetter || undefined,
        yearsExperience: yearsExperience ? parseInt(yearsExperience) : undefined,
        availability: availability || undefined,
        status: 'PENDING',
      };

      if (req.file) {
        data.resumeUrl = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/resumes');
      }

      if (req.body.references) {
        data.references = JSON.parse(req.body.references);
      }

      const application = await db.jobApplication.create({
        data,
        include: {
          job: {
            include: {
              campground: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      res.json(application);
    } catch (error: any) {
      console.error('Apply for job error:', error);
      res.status(500).json({ error: 'Failed to apply for job' });
    }
  }
);

// GET /api/jobs/applications/my - Get user's applications
router.get('/applications/my', authenticateToken, async (req, res) => {
  try {
    const applications = await db.jobApplication.findMany({
      where: { userId: (req as any).user!.id },
      include: {
        job: {
          include: {
            campground: {
              select: {
                id: true,
                name: true,
                location: true,
                imageUrl: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });

    res.json(applications);
  } catch (error: any) {
    console.error('Get my applications error:', error);
    res.status(500).json({ error: 'Failed to get applications' });
  }
});

// GET /api/jobs/postings/:jobId/applications - Get applications for a job (admin only)
router.get('/postings/:jobId/applications', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;

    const jobPosting = await db.jobPosting.findUnique({
      where: { id: jobId },
      include: {
        campground: {
          include: { admins: true },
        },
      },
    });

    if (!jobPosting) {
      return res.status(404).json({ error: 'Job posting not found' });
    }

    const isAdmin = jobPosting.campground.admins.some((admin: any) => admin.userId === (req as any).user!.id);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const applications = await db.jobApplication.findMany({
      where: { jobId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            profilePicture: true,
            location: true,
          },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });

    res.json(applications);
  } catch (error: any) {
    console.error('Get job applications error:', error);
    res.status(500).json({ error: 'Failed to get applications' });
  }
});

// PUT /api/jobs/applications/:id/status - Update application status (admin only)
router.put('/applications/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const application = await db.jobApplication.findUnique({
      where: { id },
      include: {
        job: {
          include: {
            campground: {
              include: { admins: true },
            },
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const isAdmin = application.job.campground.admins.some((admin: any) => admin.userId === (req as any).user!.id);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await db.jobApplication.update({
      where: { id },
      data: {
        status,
        notes: notes || undefined,
        reviewedAt: new Date(),
      },
      include: {
        user: true,
        job: true,
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Update application status error:', error);
    res.status(500).json({ error: 'Failed to update application status' });
  }
});

// POST /api/jobs/resume - Create/update user resume
router.post(
  '/resume',
  authenticateToken,
  upload.single('resumeFile'),
  async (req, res) => {
    try {
      const {
        fullName,
        email,
        phone,
        location,
        summary,
        skills,
        experience,
        education,
        certifications,
        rvDetails,
        availability,
        references,
      } = req.body;

      const data: any = {
        fullName,
        email,
        phone: phone || undefined,
        location: location || undefined,
        summary: summary || undefined,
        skills: skills ? (Array.isArray(skills) ? skills : JSON.parse(skills)) : [],
        experience: experience ? JSON.parse(experience) : [],
        education: education ? JSON.parse(education) : [],
        certifications: certifications ? (Array.isArray(certifications) ? certifications : JSON.parse(certifications)) : [],
        rvDetails: rvDetails || undefined,
        availability: availability || undefined,
        references: references ? JSON.parse(references) : [],
      };

      if (req.file) {
        data.resumeFileUrl = await uploadBufferToCloudinary(req.file.buffer, 'rvunicorn/resumes');
      }

      const resume = await db.userResume.upsert({
        where: { userId: (req as any).user!.id },
        update: data,
        create: {
          userId: (req as any).user!.id,
          ...data,
        },
      });

      res.json(resume);
    } catch (error: any) {
      console.error('Save resume error:', error);
      res.status(500).json({ error: 'Failed to save resume' });
    }
  }
);

// GET /api/jobs/resume/my - Get user's resume
router.get('/resume/my', authenticateToken, async (req, res) => {
  try {
    const resume = await db.userResume.findUnique({
      where: { userId: (req as any).user!.id },
    });

    res.json(resume);
  } catch (error: any) {
    console.error('Get resume error:', error);
    res.status(500).json({ error: 'Failed to get resume' });
  }
});

export default router;
