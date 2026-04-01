import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Edit2, Check, UserPlus, MapPin } from 'lucide-react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

interface Attendee {
  id: string; status: string; userId: string;
  confirmationNumber?: string; siteNumber?: string; notes?: string;
  user: { id: string; username: string; firstName: string; lastName: string; profilePicture?: string };
}
interface CalendarItem {
  id: string; tripId?: string; type: 'EVENT'|'STAY'|'TRAVEL_DAY'; title: string;
  startDate: string; endDate: string;
  campground?: { id: string; name: string; location: string };
  isOrganizer: boolean;
  myAttendee?: { confirmationNumber?: string; siteNumber?: string; notes?: string; userId?: string };
  attendees: Attendee[]; color: string;
  hasRoute?: boolean;
  dayType?: string;
}
interface Props { compact?: boolean; userId?: string; }

const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];


// Infer day emoji from calendar items
const getDayEmoji = (hits: CalendarItem[]): string => {
  const hasStay = hits.some(h => h.type === 'STAY');
  const hasEvent = hits.some(h => h.type === 'EVENT');
  if (hasStay || hasEvent) return '⛺';
  return '';
};

const isReturnDay = (hits: CalendarItem[], dateStr: string): boolean => {
  // Show 🏠 on the day a trip/event ends (return home day)
  return hits.some(h => {
    const end = new Date(h.endDate);
    const d = new Date(dateStr);
    return end.toDateString() === d.toDateString();
  });
};

const isDrivingDay = (hits: CalendarItem[]): 'route' | 'estimated' | false => {
  const travelDay = hits.find(h => h.type === 'TRAVEL_DAY');
  if (!travelDay) return false;
  return travelDay.hasRoute ? 'route' : 'estimated';
};

export default function TripCalendarWidget({ compact=false, userId }: Props) {
  const today=new Date();
  const [year,setYear]=useState(today.getFullYear());
  const [month,setMonth]=useState(today.getMonth()+1);
  const [items,setItems]=useState<CalendarItem[]>([]);
  const [selected,setSelected]=useState<CalendarItem[]|null>(null);
  const [selDay,setSelDay]=useState<number|null>(null);
  const [editKey,setEditKey]=useState<string|null>(null);
  const [editField,setEditField]=useState<string|null>(null);
  const [editValue,setEditValue]=useState('');
  const [saving,setSaving]=useState(false);
  const [tagging,setTagging]=useState<string|null>(null);
  const [tagSearch,setTagSearch]=useState('');
  const [tagResults,setTagResults]=useState<any[]>([]);
  const navigate = useNavigate();

  const fetchItems=useCallback(async()=>{
    try {
      const params:any={month,year};
      if(userId) params.userId=userId;
      const {data}=await api.get('/calendar',{params});
      setItems(data.items||[]);
    } catch(e){console.error(e);}
  },[month,year,userId]);

  useEffect(()=>{fetchItems();},[fetchItems]);

  // Refresh when user returns to the tab (clears stale deleted trips)
  useEffect(()=>{
    const onFocus = () => fetchItems();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  },[fetchItems]);

  const daysInMonth=new Date(year,month,0).getDate();
  const firstDay=new Date(year,month-1,1).getDay();

  const itemsOnDay=(day:number)=>{
    const d=new Date(year,month-1,day);
    return items.filter(it=>{
      const s=new Date(it.startDate),e=new Date(it.endDate);
      return d>=new Date(s.getFullYear(),s.getMonth(),s.getDate()) &&
             d<=new Date(e.getFullYear(),e.getMonth(),e.getDate());
    });
  };

  const prevMonth=()=>month===1?(setMonth(12),setYear(y=>y-1)):setMonth(m=>m-1);
  const nextMonth=()=>month===12?(setMonth(1),setYear(y=>y+1)):setMonth(m=>m+1);

  const saveRes=async(item:CalendarItem,targetUserId?:string)=>{
    setSaving(true);
    try {
      const payload:any={};
      if(editField==='confirmation') payload.confirmationNumber=editValue;
      else if(editField==='site') payload.siteNumber=editValue;
      else if(editField==='notes') payload.notes=editValue;
      if(targetUserId) payload.targetUserId=targetUserId;
      if(item.type==='EVENT') await api.patch(`/calendar/events/${item.id}/reservation`,payload);
      else await api.patch(`/calendar/stays/${item.id}/reservation`,payload);
      await fetchItems();
      setEditKey(null);setEditField(null);setEditValue('');
    } catch(e){console.error(e);}
    finally{setSaving(false);}
  };

  const searchFriends=async(q:string)=>{
    if(q.length<2){setTagResults([]);return;}
    try{const{data}=await api.get('/friends/search',{params:{q}});setTagResults(data.users||data.friends||[]);}
    catch(e){console.error(e);}
  };

  const tagFriend=async(eventId:string,fId:string)=>{
    try{await api.post(`/calendar/events/${eventId}/attendees`,{userId:fId});await fetchItems();setTagging(null);setTagSearch('');setTagResults([]);}
    catch(e){console.error(e);}
  };

  const ResCard=({item,attendee,isMe}:{item:CalendarItem;attendee:any;isMe:boolean})=>{
    const aId=attendee?.user?.id||'me';
    const eKey=`${item.id}-${aId}`;
    const canEdit=isMe||item.isOrganizer;
    const EF=({field,label,val,color,ph}:any)=>{
      const active=editKey===eKey&&editField===field;
      return (
        <div>
          <div className="text-xs mb-1" style={{color:'#6b7280'}}>{label}</div>
          {active?(
            <div className="flex gap-1">
              <input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&saveRes(item,attendee?.user?.id)}
                placeholder={ph} className="flex-1 text-xs rounded-lg px-2 py-1.5 text-white outline-none"
                style={{background:'#f3f4f6',border:`1px solid ${color}66`}}/>
              <button onClick={()=>saveRes(item,attendee?.user?.id)} disabled={saving}
                className="px-2 py-1 rounded-lg text-xs font-bold" style={{background:color,color:'#000'}}>
                {saving?'…':<Check size={11}/>}
              </button>
            </div>
          ):(
            <div className="flex items-center gap-1 group/f">
              <span className="text-sm font-mono" style={{color:val?color:'#d1d5db'}}>{val||'—'}</span>
              {canEdit&&<button onClick={()=>{setEditKey(eKey);setEditField(field);setEditValue(val||'');}}
                className="opacity-0 group-hover/f:opacity-100 transition-opacity">
                <Edit2 size={11} style={{color:'#9ca3af'}}/>
              </button>}
            </div>
          )}
        </div>
      );
    };
    return (
      <div className="rounded-xl p-3 mb-2" style={{background:'#ffffff',border:'1px solid #e5e7eb'}}>
        {attendee?.user&&(
          <div className="flex items-center gap-2 mb-2">
            {attendee.user.profilePicture
              ?<img src={attendee.user.profilePicture} className="w-7 h-7 rounded-full object-cover" alt=""/>
              :<div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{attendee.user.firstName?.[0]}</div>
            }
            <span className="text-sm font-semibold text-gray-800">{attendee.user.firstName} {attendee.user.lastName}</span>
            {isMe&&<span className="text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(245,158,11,.12)',color:'rgba(245,158,11,.9)',border:'1px solid rgba(245,158,11,.2)'}}>You</span>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <EF field="confirmation" label="Confirmation #" val={attendee?.confirmationNumber} color="#f59e0b" ph="e.g. RV-29184"/>
          <EF field="site" label="Site #" val={attendee?.siteNumber} color="#34d399" ph="e.g. A14"/>
        </div>
        {isMe&&<div className="mt-2"><EF field="notes" label="Notes" val={attendee?.notes} color="#60a5fa" ph="Personal notes..."/></div>}
      </div>
    );
  };

  if(compact) return (
    <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'16px',overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid #f3f4f6'}}>
        <span style={{fontWeight:700,fontSize:'14px',color:'#111827'}}>My Calendar</span>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
          <button onClick={prevMonth} style={{width:'24px',height:'24px',borderRadius:'50%',border:'none',background:'#f3f4f6',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><ChevronLeft size={13} color="#6b7280"/></button>
          <span style={{fontSize:'12px',fontWeight:600,color:'#374151',width:'88px',textAlign:'center'}}>{MONTHS[month-1].slice(0,3)} {year}</span>
          <button onClick={nextMonth} style={{width:'24px',height:'24px',borderRadius:'50%',border:'none',background:'#f3f4f6',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><ChevronRight size={13} color="#6b7280"/></button>
        </div>
      </div>
      <div style={{padding:'8px 12px'}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',marginBottom:'4px'}}>
          {DAYS.map(d=><div key={d} style={{textAlign:'center',fontSize:'11px',fontWeight:700,color:'#9ca3af'}}>{d[0]}</div>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'2px'}}>
          {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
            const hits=itemsOnDay(day);
            const isToday=day===today.getDate()&&month===today.getMonth()+1&&year===today.getFullYear();
            return(
              <button key={day} onClick={()=>{
                  if(hits.length===1) {
                    const h=hits[0];
                    // Don't navigate for estimated travel days — they have fake IDs
                    if (h.id.startsWith('est-travel-')) {
                      setSelDay(day); setSelected(hits);
                    } else {
                      navigate(h.type==='STAY' ? `/trips/${h.tripId||h.id}` : `/trips/${h.id}`);
                    }
                  } else {
                    setSelDay(day);setSelected(hits.length?hits:null);
                  }
                }}
                style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'32px',borderRadius:'8px',border:'none',cursor:'pointer',fontSize:'11px',fontWeight:hits.length?700:400,background:isToday?'#f59e0b':hits.length?'#eff6ff':'transparent',color:isToday?'#fff':hits.length?'#1d4ed8':'#374151'}}>
                {hits.length > 0 ? (
                  <span style={{fontSize:'13px'}}>
                    {isDrivingDay(hits) === 'estimated' ? '🔵🚗' : isDrivingDay(hits) === 'route' ? '🚗' : getDayEmoji(hits) || ''}
                  </span>
                ) : (
                  <span>{day}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {items.filter(it=>new Date(it.startDate)>=today).slice(0,3).map(it=>(
        <div key={it.id} style={{display:'flex',alignItems:'flex-start',gap:'8px',padding:'8px 16px',borderTop:'1px solid #f3f4f6'}}>
          <div style={{width:'6px',height:'6px',borderRadius:'50%',background:it.color,marginTop:'5px',flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'12px',fontWeight:600,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.title}</div>
            <div style={{fontSize:'11px',color:'#9ca3af'}}>{new Date(it.startDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})}{it.campground&&` · ${it.campground.name}`}</div>
          </div>
        </div>
      ))}
      <div style={{padding:'8px 16px',borderTop:'1px solid #f3f4f6',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',gap:'8px',fontSize:'11px',color:'#9ca3af',flexWrap:'wrap'}}>
          <span>⛺ camping</span><span>🚗 driving</span><span>🔵🚗 est. travel</span><span>🏠 return home</span>
        </div>
        <button onClick={()=>navigate('/calendar')} style={{fontSize:'11px',fontWeight:600,color:'#f59e0b',border:'none',background:'none',cursor:'pointer'}}>View all →</button>
      </div>
      {selDay&&(
        <div style={{padding:'12px 16px',borderTop:'1px solid #f3f4f6'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
            <span style={{fontSize:'12px',fontWeight:700,color:'#111827'}}>{MONTHS[month-1]} {selDay}</span>
            <button onClick={()=>{setSelDay(null);setSelected(null);}} style={{border:'none',background:'none',cursor:'pointer'}}><X size={13} color="#9ca3af"/></button>
          </div>
          {selected && selected.map(item=>(
            <div key={item.id} style={{marginBottom:'8px',borderRadius:'12px',padding:'12px',background:'#f9fafb',border:`1px solid ${item.color}44`}}>
              <div style={{fontSize:'13px',fontWeight:700,color:'#111827',marginBottom:'4px'}}>{item.title}</div>
              {item.campground&&<div style={{fontSize:'11px',color:'#6b7280',marginBottom:'8px'}}>{item.campground.name}</div>}
              {item.id.startsWith('est-travel-') ? (
                <div style={{fontSize:'12px',color:'#3b82f6',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'8px',padding:'8px'}}>
                  🔵🚗 Estimated travel day — <button onClick={()=>navigate(`/trips/${item.tripId}`)} style={{color:'#2563eb',fontWeight:600,background:'none',border:'none',cursor:'pointer',padding:0}}>add a route to confirm dates →</button>
                </div>
              ) : (
                <ResCard item={item} attendee={item.myAttendee} isMe={true}/>
              )}
            </div>
          ))}
          {(!selected || !selected.length) && (
            <div>
              <p style={{fontSize:'12px',color:'#6b7280',marginBottom:'8px'}}>Nothing planned — add something?</p>
              <div style={{display:'flex',gap:'8px'}}>
                <button
                  onClick={()=>navigate(`/trips?create=true&startDate=${year}-${String(month).padStart(2,'0')}-${String(selDay).padStart(2,'0')}`)}
                  style={{flex:1,padding:'8px',borderRadius:'10px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'12px',fontWeight:600,color:'#374151',display:'flex',alignItems:'center',justifyContent:'center',gap:'4px'}}>
                  🗺️ Plan Trip
                </button>
                <button
                  onClick={()=>navigate(`/trips?create=true&type=event&startDate=${year}-${String(month).padStart(2,'0')}-${String(selDay).padStart(2,'0')}`)}
                  style={{flex:1,padding:'8px',borderRadius:'10px',border:'1px solid #e5e7eb',background:'#fff',cursor:'pointer',fontSize:'12px',fontWeight:600,color:'#374151',display:'flex',alignItems:'center',justifyContent:'center',gap:'4px'}}>
                  🎪 Create Event
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );


  return (
    <div className="p-4" style={{color:'#1f2937'}}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Trip Calendar</h2>
          <p className="text-sm mt-0.5" style={{color:'#6b7280'}}>Events, stays &amp; reservations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:'#f3f4f6',border:'1px solid rgba(255,255,255,.1)'}}><ChevronLeft size={16}/></button>
          <span className="text-base font-bold w-36 text-center">{MONTHS[month-1]} {year}</span>
          <button onClick={nextMonth} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:'#f3f4f6',border:'1px solid rgba(255,255,255,.1)'}}><ChevronRight size={16}/></button>
        </div>
      </div>
      <div className="flex gap-4 mb-4 text-xs" style={{color:'#6b7280'}}>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{background:'#f59e0b'}}/> Events</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{background:'#34d399'}}/> Trip Stays</div>
      </div>
      <div className="rounded-2xl overflow-hidden mb-5" style={{background:'#ffffff',border:'1px solid #e5e7eb'}}>
        <div className="grid grid-cols-7" style={{borderBottom:'1px solid rgba(255,255,255,.07)'}}>
          {DAYS.map(d=><div key={d} className="py-3 text-center text-xs font-bold" style={{color:'#6b7280'}}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`} className="min-h-20 p-1" style={{borderRight:'1px solid rgba(255,255,255,.05)',borderBottom:'1px solid rgba(255,255,255,.05)'}}/>)}
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
            const hits=itemsOnDay(day);
            const isToday=day===today.getDate()&&month===today.getMonth()+1&&year===today.getFullYear();
            const isSel=selDay===day;
            return(
              <div key={day} onClick={()=>{setSelDay(isSel?null:day);setSelected(hits.length?hits:null);}}
                className="min-h-20 p-2 cursor-pointer transition-all"
                style={{borderRight:'1px solid rgba(255,255,255,.05)',borderBottom:'1px solid rgba(255,255,255,.05)',background:isSel?'rgba(245,158,11,.08)':'transparent'}}>
                <div className="mb-1">
                  <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold"
                    style={{background:isToday?'#f59e0b':'transparent',color:isToday?'#000':'#374151'}}>
                    {day}
                  </span>
                </div>
                {hits.slice(0,3).map(h=>(
                  <div key={h.id} className="text-xs px-1.5 py-0.5 rounded-md truncate font-semibold mb-0.5"
                    style={{background:`${h.color}22`,color:h.color,border:`1px solid ${h.color}33`}}>
                    {h.title}
                  </div>
                ))}
                {hits.length>3&&<div className="text-xs" style={{color:'#6b7280'}}>+{hits.length-3} more</div>}
              </div>
            );
          })}
        </div>
      </div>
      {selDay&&selected&&(
        <div className="rounded-2xl overflow-hidden" style={{background:'#ffffff',border:'1px solid #e5e7eb'}}>
          <div className="flex items-center justify-between px-5 py-4" style={{borderBottom:'1px solid rgba(255,255,255,.07)'}}>
            <h3 className="font-bold text-base text-gray-900">{MONTHS[month-1]} {selDay}, {year}</h3>
            <button onClick={()=>{setSelDay(null);setSelected(null);}}><X size={16} style={{color:'#6b7280'}}/></button>
          </div>
          <div className="p-5 space-y-5">
            {selected.map(item=>(
              <div key={item.id} className="rounded-2xl overflow-hidden" style={{border:`1px solid ${item.color}33`}}>
                <div className="px-5 py-4 flex items-start justify-between" style={{background:`${item.color}12`}}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{background:item.color}}/>
                      <span className="font-extrabold text-gray-900">{item.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'#f3f4f6',color:'#6b7280'}}>{item.type==='EVENT'?'Event':'Stay'}</span>
                    </div>
                    {item.campground&&<div className="flex items-center gap-1 text-xs" style={{color:'#6b7280'}}><MapPin size={11}/>{item.campground.name} · {item.campground.location}</div>}
                    <div className="text-xs mt-1" style={{color:'#6b7280'}}>
                      {new Date(item.startDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})} – {new Date(item.endDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                    </div>
                  </div>
                  {item.isOrganizer&&item.type==='EVENT'&&(
                    <button onClick={()=>setTagging(tagging===item.id?null:item.id)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 ml-4"
                      style={{background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.3)',color:'rgba(245,158,11,.9)'}}>
                      <UserPlus size={12}/> Tag Friend
                    </button>
                  )}
                </div>
                {tagging===item.id&&(
                  <div className="px-5 py-3" style={{borderBottom:'1px solid rgba(255,255,255,.07)',background:'rgba(245,158,11,.05)'}}>
                    <input value={tagSearch} onChange={e=>{setTagSearch(e.target.value);searchFriends(e.target.value);}}
                      className="w-full text-sm rounded-xl px-3 py-2 text-white outline-none"
                      style={{background:'#f3f4f6',border:'1px solid rgba(245,158,11,.3)'}}
                      placeholder="Search friends to tag..."/>
                    {tagResults.map(f=>(
                      <button key={f.id} onClick={()=>tagFriend(item.id,f.id)}
                        className="flex items-center gap-2 w-full text-left px-2 py-2 rounded-xl mt-1 hover:bg-white/10 transition-colors">
                        {f.profilePicture?<img src={f.profilePicture} className="w-7 h-7 rounded-full object-cover" alt=""/>
                          :<div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{f.firstName?.[0]}</div>}
                        <span className="text-sm text-white">{f.firstName} {f.lastName}</span>
                        <span className="text-xs" style={{color:'#6b7280'}}>@{f.username}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="px-5 py-4">
                  <div className="text-xs font-bold mb-3" style={{color:'#6b7280',textTransform:'uppercase',letterSpacing:'.1em'}}>
                    {item.type==='EVENT'?'Attendees & Reservations':'Your Reservation'}
                  </div>
                  {item.type==='EVENT'
                    ?item.attendees.map(att=><ResCard key={att.id} item={item} attendee={att} isMe={att.userId===item.myAttendee?.userId}/>)
                    :<ResCard item={item} attendee={item.myAttendee} isMe={true}/>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
