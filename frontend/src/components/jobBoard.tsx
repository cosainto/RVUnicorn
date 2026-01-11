import { useState, useEffect } from 'react';
import { Briefcase, MapPin, Calendar, DollarSign, Home, Tent, Filter, Search, Clock, Users } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface JobPosting {
  id: string;
  title: string;
  description: string;
  category: string;
  jobType: string;
  startDate?: string;
  endDate?: string;
  hoursPerWeek?: number;
  payRate?: number;
  payType?: string;
  housingProvided: boolean;
  housingDetails?: string;
  rvSiteProvided: boolean;
  rvSiteDetails?: string;
  utilitiesIncluded: boolean;
  mealsIncluded: boolean;
  requirements: string[];
  benefits: string[];
  duties: string[];
  contactEmail: string;
  contactPhone?: string;
  createdAt: string;
  campground: {
    id: string;
    name: string;
    location: string;
    imageUrl?: string;
    slug: string;
  };
  _count: {
    applications: number;
  };
}

const JOB_CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'FRONT_DESK', label: 'Front Desk' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'GROUNDSKEEPING', label: 'Groundskeeping' },
  { value: 'ACTIVITIES', label: 'Activities' },
  { value: 'RETAIL', label: 'Retail/Store' },
  { value: 'FOOD_SERVICE', label: 'Food Service' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'OTHER', label: 'Other' },
];

const JOB_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'SEASONAL', label: 'Seasonal' },
  { value: 'VOLUNTEER', label: 'Volunteer' },
  { value: 'WORKAMPING', label: 'Workamping' },
];

const CATEGORY_ICONS: { [key: string]: string } = {
  FRONT_DESK: '🏢',
  MAINTENANCE: '🔧',
  HOUSEKEEPING: '🧹',
  GROUNDSKEEPING: '🌳',
  ACTIVITIES: '🎯',
  RETAIL: '🛒',
  FOOD_SERVICE: '🍽️',
  SECURITY: '🔒',
  MANAGEMENT: '👔',
  OTHER: '📋',
};

export default function JobBoard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [housingFilter, setHousingFilter] = useState(false);
  const [rvSiteFilter, setRvSiteFilter] = useState(false);

  // Application form
  const [applicationForm, setApplicationForm] = useState({
    coverLetter: '',
    yearsExperience: '',
    availability: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  useEffect(() => {
    loadJobs();
  }, [categoryFilter, jobTypeFilter, housingFilter, rvSiteFilter]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter) params.append('category', categoryFilter);
      if (jobTypeFilter) params.append('jobType', jobTypeFilter);
      if (housingFilter) params.append('housingProvided', 'true');
      if (rvSiteFilter) params.append('rvSiteProvided', 'true');

      const { data } = await api.get(`/jobs/postings?${params}`);
      setJobs(data);
    } catch (error) {
      console.error('Load jobs error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('Please log in to apply');
      navigate('/login');
      return;
    }

    if (!selectedJob) return;

    try {
      const formData = new FormData();
      formData.append('jobId', selectedJob.id);
      formData.append('coverLetter', applicationForm.coverLetter);
      formData.append('yearsExperience', applicationForm.yearsExperience);
      formData.append('availability', applicationForm.availability);
      
      if (resumeFile) {
        formData.append('resume', resumeFile);
      }

      await api.post('/jobs/apply', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowApplicationModal(false);
      setSelectedJob(null);
      setApplicationForm({ coverLetter: '', yearsExperience: '', availability: '' });
      setResumeFile(null);
      alert('Application submitted successfully! 🎉');
      await loadJobs();
    } catch (error: any) {
      console.error('Apply error:', error);
      alert(error.response?.data?.error || 'Failed to submit application');
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      job.title.toLowerCase().includes(search) ||
      job.description.toLowerCase().includes(search) ||
      job.campground.name.toLowerCase().includes(search) ||
      job.campground.location.toLowerCase().includes(search)
    );
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Briefcase className="w-8 h-8" />
          Campground Job Board
        </h1>
        <p className="text-gray-600 mt-2">Find seasonal work and workamping opportunities</p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search jobs, campgrounds, locations..."
                className="input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input"
            >
              {JOB_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Type
            </label>
            <select
              value={jobTypeFilter}
              onChange={(e) => setJobTypeFilter(e.target.value)}
              className="input"
            >
              {JOB_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={housingFilter}
              onChange={(e) => setHousingFilter(e.target.checked)}
              className="text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Housing Provided</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rvSiteFilter}
              onChange={(e) => setRvSiteFilter(e.target.checked)}
              className="text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">RV Site Provided</span>
          </label>
        </div>
      </div>

      {/* Job Listings */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading job opportunities...</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-2">No jobs found</p>
          <p className="text-gray-500 text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer"
              onClick={() => setSelectedJob(job)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{CATEGORY_ICONS[job.category] || '📋'}</span>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{job.title}</h3>
                      <p className="text-gray-600">{job.campground.name}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {job.campground.location}
                    </div>
                    {job.payRate && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        ${job.payRate}/{job.payType || 'hr'}
                      </div>
                    )}
                    {job.hoursPerWeek && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {job.hoursPerWeek} hrs/week
                      </div>
                    )}
                    {job.startDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Starts {new Date(job.startDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  <p className="text-gray-700 mb-3 line-clamp-2">{job.description}</p>

                  <div className="flex flex-wrap gap-2">
                    <span className="bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded">
                      {JOB_TYPES.find(t => t.value === job.jobType)?.label}
                    </span>
                    {job.housingProvided && (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded flex items-center gap-1">
                        <Home className="w-3 h-3" />
                        Housing
                      </span>
                    )}
                    {job.rvSiteProvided && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded flex items-center gap-1">
                        <Tent className="w-3 h-3" />
                        RV Site
                      </span>
                    )}
                    {job.utilitiesIncluded && (
                      <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded">
                        Utilities
                      </span>
                    )}
                    {job.mealsIncluded && (
                      <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded">
                        Meals
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedJob(job);
                      setShowApplicationModal(true);
                    }}
                    className="btn btn-primary"
                  >
                    Apply Now
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    <Users className="w-3 h-3 inline mr-1" />
                    {job._count.applications} applicants
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Job Detail Modal */}
      {selectedJob && !showApplicationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">{selectedJob.title}</h2>
                  <p className="text-primary-100">{selectedJob.campground.name}</p>
                  <p className="text-primary-100 text-sm">{selectedJob.campground.location}</p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-white hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Job Details */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Job Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Type</p>
                    <p className="font-medium">{JOB_TYPES.find(t => t.value === selectedJob.jobType)?.label}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Category</p>
                    <p className="font-medium">{JOB_CATEGORIES.find(c => c.value === selectedJob.category)?.label}</p>
                  </div>
                  {selectedJob.payRate && (
                    <div>
                      <p className="text-sm text-gray-600">Pay Rate</p>
                      <p className="font-medium">${selectedJob.payRate}/{selectedJob.payType || 'hr'}</p>
                    </div>
                  )}
                  {selectedJob.hoursPerWeek && (
                    <div>
                      <p className="text-sm text-gray-600">Hours/Week</p>
                      <p className="font-medium">{selectedJob.hoursPerWeek}</p>
                    </div>
                  )}
                  {selectedJob.startDate && (
                    <div>
                      <p className="text-sm text-gray-600">Start Date</p>
                      <p className="font-medium">{new Date(selectedJob.startDate).toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedJob.endDate && (
                    <div>
                      <p className="text-sm text-gray-600">End Date</p>
                      <p className="font-medium">{new Date(selectedJob.endDate).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-700 whitespace-pre-line">{selectedJob.description}</p>
              </div>

              {/* Duties */}
              {selectedJob.duties.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Duties & Responsibilities</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedJob.duties.map((duty, index) => (
                      <li key={index} className="text-gray-700">{duty}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirements */}
              {selectedJob.requirements.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Requirements</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedJob.requirements.map((req, index) => (
                      <li key={index} className="text-gray-700">{req}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Benefits */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Benefits & Perks</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedJob.housingProvided && (
                    <div className="flex items-start gap-2">
                      <Home className="w-5 h-5 text-green-600 mt-1" />
                      <div>
                        <p className="font-medium text-gray-900">Housing Provided</p>
                        {selectedJob.housingDetails && (
                          <p className="text-sm text-gray-600">{selectedJob.housingDetails}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedJob.rvSiteProvided && (
                    <div className="flex items-start gap-2">
                      <Tent className="w-5 h-5 text-blue-600 mt-1" />
                      <div>
                        <p className="font-medium text-gray-900">RV Site Provided</p>
                        {selectedJob.rvSiteDetails && (
                          <p className="text-sm text-gray-600">{selectedJob.rvSiteDetails}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {selectedJob.utilitiesIncluded && (
                    <div className="flex items-start gap-2">
                      <span className="text-purple-600 text-xl mt-1">⚡</span>
                      <div>
                        <p className="font-medium text-gray-900">Utilities Included</p>
                      </div>
                    </div>
                  )}
                  {selectedJob.mealsIncluded && (
                    <div className="flex items-start gap-2">
                      <span className="text-orange-600 text-xl mt-1">🍽️</span>
                      <div>
                        <p className="font-medium text-gray-900">Meals Included</p>
                      </div>
                    </div>
                  )}
                  {selectedJob.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-primary-600 text-xl mt-1">✓</span>
                      <p className="text-gray-700">{benefit}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="border-t pt-4">
                <h3 className="font-bold text-gray-900 mb-2">Contact Information</h3>
                <p className="text-gray-700">
                  Email: <a href={`mailto:${selectedJob.contactEmail}`} className="text-primary-600 hover:underline">{selectedJob.contactEmail}</a>
                </p>
                {selectedJob.contactPhone && (
                  <p className="text-gray-700">
                    Phone: <a href={`tel:${selectedJob.contactPhone}`} className="text-primary-600 hover:underline">{selectedJob.contactPhone}</a>
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowApplicationModal(true)}
                  className="btn btn-primary flex-1"
                >
                  Apply for This Position
                </button>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Application Modal */}
      {showApplicationModal && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Apply for {selectedJob.title}</h2>
              <p className="text-primary-100 mt-1">{selectedJob.campground.name}</p>
            </div>

            <form onSubmit={handleApply} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cover Letter *
                </label>
                <textarea
                  value={applicationForm.coverLetter}
                  onChange={(e) => setApplicationForm({ ...applicationForm, coverLetter: e.target.value })}
                  rows={6}
                  className="input"
                  placeholder="Tell us why you're interested in this position..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Years of Experience
                  </label>
                  <input
                    type="number"
                    value={applicationForm.yearsExperience}
                    onChange={(e) => setApplicationForm({ ...applicationForm, yearsExperience: e.target.value })}
                    className="input"
                    min="0"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Availability
                  </label>
                  <input
                    type="text"
                    value={applicationForm.availability}
                    onChange={(e) => setApplicationForm({ ...applicationForm, availability: e.target.value })}
                    className="input"
                    placeholder="e.g., May - September"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Resume (PDF or DOC)
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">Optional - Max 5MB</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-700">
                  💡 Tip: Create a resume in your profile to quickly apply for jobs in the future!
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1">
                  Submit Application
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowApplicationModal(false);
                    setApplicationForm({ coverLetter: '', yearsExperience: '', availability: '' });
                    setResumeFile(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
