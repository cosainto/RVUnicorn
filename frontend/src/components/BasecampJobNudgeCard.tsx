import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import api from '../services/api';

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

interface Props { campgroundId: string; campgroundName: string; stayDays: number; }

export default function BasecampJobNudgeCard({ campgroundId, campgroundName, stayDays }: Props) {
  const [job, setJob] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check throttle
    const key = `job_nudge_${campgroundId}`;
    const stored = localStorage.getItem(key);
    if (stored && Date.now() < parseInt(stored)) { setDismissed(true); return; }
    if (stayDays < 3) return;

    api.get(`/jobs/campground-active/${campgroundId}`).then(r => {
      if (r.data.job) setJob(r.data.job);
    }).catch(() => {});
  }, [campgroundId, stayDays]);

  const handleDismiss = () => {
    localStorage.setItem(`job_nudge_${campgroundId}`, String(Date.now() + 7 * 86400000));
    setDismissed(true);
  };

  if (!job || dismissed) return null;

  return (
    <div className="rounded-xl p-4" style={{ background: '#1B2E50', borderLeft: '3px solid #E8A838', border: '1px solid rgba(232,168,56,0.15)' }}>
      <div className="flex items-start gap-3">
        <img src={HITCH_IMG} alt="Hitch" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] mb-1" style={{ color: '#F5F0E8' }}>
            {'\u{1F3D5}'} Loving it here at {campgroundName}?
          </p>
          <p className="text-[14px] font-bold mb-1" style={{ color: '#F5F0E8' }}>
            {campgroundName} is looking for a {job.title}
          </p>
          {job.siteIncluded ? (
            <p className="text-[12px]" style={{ color: '#E8A838' }}>Free site included · {job.hoursPerWeek ? `${job.hoursPerWeek} hrs/week` : job.jobType}</p>
          ) : (
            <p className="text-[12px]" style={{ color: '#E8A838' }}>{job.compensation || job.salary || job.jobType}</p>
          )}
          <div className="flex gap-2 mt-3">
            <Link to={`/jobs/${job.id}`} className="px-4 py-2 rounded-lg text-[12px] font-semibold" style={{ background: '#E8622A', color: 'white' }}>View Opportunity →</Link>
            <button onClick={handleDismiss} className="px-3 py-2 rounded-lg text-[12px]" style={{ color: 'rgba(245,240,232,0.3)' }}>Not interested</button>
          </div>
        </div>
        <button onClick={handleDismiss} className="flex-shrink-0 hover:opacity-60"><X className="w-4 h-4" style={{ color: 'rgba(245,240,232,0.2)' }} /></button>
      </div>
    </div>
  );
}
