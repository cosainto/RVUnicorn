import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Edit2, Check, UserPlus, MapPin } from 'lucide-react';
import api from '../services/api';

interface Attendee {
  id: string; status: string; userId: string;
  confirmationNumber?: string; siteNumber?: string; notes?: string;
  user: { id: string; username: string; firstName: string; lastName: string; profilePicture?: string };
}
interface CalendarItem {
  id: string; tripId?: string; type: 'EVENT'|'STAY'; title: string;
  startDate: string; endDate: string;
  campground?: { id: string; name: string; location: string };
  isOrganizer: boolean;
  myAttendee?: { confirmationNumber?: string; siteNumber?: string; notes?: string; userId?: string };
  attendees: Attendee[]; color: string;
}
interface Props { compact?: boolean; userId?: string; }

const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

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

  const fetchItems=useCallback(async()=>{
    try {
      const params:any={month,year};
      if(userId) params.userId=userId;
      const {data}=await api.get('/calendar',{params});
      setItems(data.items||[]);
    } catch(e){console.error(e);}
  },[month,year,userId]);

  useEffect(()=>{fetchItems();},[fetchItems]);

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
          <div className="text-xs mb-1" style={{color:'rgba(255,255,255,.4)'}}>{label}</div>
          {active?(
            <div className="flex gap-1">
              <input autoFocus value={editValue} onChange={e=>setEditValue(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&saveRes(item,attendee?.user?.id)}
                placeholder={ph} className="flex-1 text-xs rounded-lg px-2 py-1.5 text-white outline-none"
                style={{background:'rgba(255,255,255,.08)',border:`1px solid ${color}66`}}/>
              <button onClick={()=>saveRes(item,attendee?.user?.id)} disabled={saving}
                className="px-2 py-1 rounded-lg text-xs font-bold" style={{background:color,color:'#000'}}>
                {saving?'…':<Check size={11}/>}
              </button>
            </div>
          ):(
            <div className="flex items-center gap-1 group/f">
              <span className="text-sm font-mono" style={{color:val?color:'rgba(255,255,255,.25)'}}>{val||'—'}</span>
              {canEdit&&<button onClick={()=>{setEditKey(eKey);setEditField(field);setEditValue(val||'');}}
                className="opacity-0 group-hover/f:opacity-100 transition-opacity">
                <Edit2 size={11} style={{color:'rgba(255,255,255,.35)'}}/>
              </button>}
            </div>
          )}
        </div>
      );
    };
    return (
      <div className="rounded-xl p-3 mb-2" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)'}}>
        {attendee?.user&&(
          <div className="flex items-center gap-2 mb-2">
            {attendee.user.profilePicture
              ?<img src={attendee.user.profilePicture} className="w-7 h-7 rounded-full object-cover" alt=""/>
              :<div className="w-7 h-7 rounded-full bg-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-200">{attendee.user.firstName?.[0]}</div>
            }
            <span className="text-sm font-semibold text-white">{attendee.user.firstName} {attendee.user.lastName}</span>
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
    <div className="rounded-2xl overflow-hidden" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)'}}>
      <div className="flex items-center justify-between px-4 py-3" style={{borderBottom:'1px solid rgba(255,255,255,.07)'}}>
        <span className="font-bold text-sm text-white">My Calendar</span>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10"><ChevronLeft size={13} className="text-white/60"/></button>
          <span className="text-xs font-semibold text-white/70 w-24 text-center">{MONTHS[month-1].slice(0,3)} {year}</span>
          <button onClick={nextMonth} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/10"><ChevronRight size={13} className="text-white/60"/></button>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="grid grid-cols-7 mb-1">{DAYS.map(d=><div key={d} className="text-center text-xs font-bold" style={{color:'rgba(255,255,255,.3)'}}>{d[0]}</div>)}</div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {Array.from({length:firstDay}).map((_,i)=><div key={`e${i}`}/>)}
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
            const hits=itemsOnDay(day);
            const isToday=day===today.getDate()&&month===today.getMonth()+1&&year===today.getFullYear();
            return(
              <button key={day} onClick={()=>{setSelDay(day);setSelected(hits.length?hits:null);}}
                className="flex flex-col items-center justify-center h-7 rounded-lg text-xs font-semibold transition-all"
                style={{color:isToday?'#000':hits.length?'#fff':'rgba(255,255,255,.5)',background:isToday?'#f59e0b':hits.length?'rgba(255,255,255,.08)':'transparent'}}>
                {day}
                {hits.length>0&&!isToday&&<div className="flex gap-0.5 mt-0.5">{hits.slice(0,3).map(h=><div key={h.id} className="w-1 h-1 rounded-full" style={{background:h.color}}/>)}</div>}
              </button>
            );
          })}
        </div>
      </div>
      {items.filter(it=>new Date(it.startDate)>=today).slice(0,3).map(it=>(
        <div key={it.id} className="flex items-start gap-2 px-4 py-2" style={{borderTop:'1px solid rgba(255,255,255,.05)'}}>
          <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{background:it.color}}/>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{it.title}</div>
            <div className="text-xs" style={{color:'rgba(255,255,255,.4)'}}>{new Date(it.startDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})}{it.campground&&` · ${it.campground.name}`}</div>
          </div>
        </div>
      ))}
      {selDay&&selected&&(
        <div className="px-4 pb-4 pt-2" style={{borderTop:'1px solid rgba(255,255,255,.07)'}}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white">{MONTHS[month-1]} {selDay}</span>
            <button onClick={()=>{setSelDay(null);setSelected(null);}}><X size={13} style={{color:'rgba(255,255,255,.4)'}}/></button>
          </div>
          {selected.map(item=>(
            <div key={item.id} className="mb-2 rounded-xl p-3" style={{background:'rgba(255,255,255,.05)',border:`1px solid ${item.color}44`}}>
              <div className="text-sm font-bold text-white mb-1">{item.title}</div>
              {item.campground&&<div className="text-xs mb-2" style={{color:'rgba(255,255,255,.45)'}}>{item.campground.name}</div>}
              <ResCard item={item} attendee={item.myAttendee} isMe={true}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-4" style={{color:'#fff'}}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-white">Trip Calendar</h2>
          <p className="text-sm mt-0.5" style={{color:'rgba(255,255,255,.5)'}}>Events, stays &amp; reservations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.1)'}}><ChevronLeft size={16}/></button>
          <span className="text-base font-bold w-36 text-center">{MONTHS[month-1]} {year}</span>
          <button onClick={nextMonth} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.1)'}}><ChevronRight size={16}/></button>
        </div>
      </div>
      <div className="flex gap-4 mb-4 text-xs" style={{color:'rgba(255,255,255,.5)'}}>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{background:'#f59e0b'}}/> Events</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{background:'#34d399'}}/> Trip Stays</div>
      </div>
      <div className="rounded-2xl overflow-hidden mb-5" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)'}}>
        <div className="grid grid-cols-7" style={{borderBottom:'1px solid rgba(255,255,255,.07)'}}>
          {DAYS.map(d=><div key={d} className="py-3 text-center text-xs font-bold" style={{color:'rgba(255,255,255,.4)'}}>{d}</div>)}
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
                    style={{background:isToday?'#f59e0b':'transparent',color:isToday?'#000':'rgba(255,255,255,.6)'}}>
                    {day}
                  </span>
                </div>
                {hits.slice(0,3).map(h=>(
                  <div key={h.id} className="text-xs px-1.5 py-0.5 rounded-md truncate font-semibold mb-0.5"
                    style={{background:`${h.color}22`,color:h.color,border:`1px solid ${h.color}33`}}>
                    {h.title}
                  </div>
                ))}
                {hits.length>3&&<div className="text-xs" style={{color:'rgba(255,255,255,.4)'}}>+{hits.length-3} more</div>}
              </div>
            );
          })}
        </div>
      </div>
      {selDay&&selected&&(
        <div className="rounded-2xl overflow-hidden" style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)'}}>
          <div className="flex items-center justify-between px-5 py-4" style={{borderBottom:'1px solid rgba(255,255,255,.07)'}}>
            <h3 className="font-bold text-base text-white">{MONTHS[month-1]} {selDay}, {year}</h3>
            <button onClick={()=>{setSelDay(null);setSelected(null);}}><X size={16} style={{color:'rgba(255,255,255,.5)'}}/></button>
          </div>
          <div className="p-5 space-y-5">
            {selected.map(item=>(
              <div key={item.id} className="rounded-2xl overflow-hidden" style={{border:`1px solid ${item.color}33`}}>
                <div className="px-5 py-4 flex items-start justify-between" style={{background:`${item.color}12`}}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{background:item.color}}/>
                      <span className="font-extrabold text-white">{item.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{background:'rgba(255,255,255,.08)',color:'rgba(255,255,255,.5)'}}>{item.type==='EVENT'?'Event':'Stay'}</span>
                    </div>
                    {item.campground&&<div className="flex items-center gap-1 text-xs" style={{color:'rgba(255,255,255,.5)'}}><MapPin size={11}/>{item.campground.name} · {item.campground.location}</div>}
                    <div className="text-xs mt-1" style={{color:'rgba(255,255,255,.4)'}}>
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
                      style={{background:'rgba(255,255,255,.08)',border:'1px solid rgba(245,158,11,.3)'}}
                      placeholder="Search friends to tag..."/>
                    {tagResults.map(f=>(
                      <button key={f.id} onClick={()=>tagFriend(item.id,f.id)}
                        className="flex items-center gap-2 w-full text-left px-2 py-2 rounded-xl mt-1 hover:bg-white/10 transition-colors">
                        {f.profilePicture?<img src={f.profilePicture} className="w-7 h-7 rounded-full object-cover" alt=""/>
                          :<div className="w-7 h-7 rounded-full bg-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-200">{f.firstName?.[0]}</div>}
                        <span className="text-sm text-white">{f.firstName} {f.lastName}</span>
                        <span className="text-xs" style={{color:'rgba(255,255,255,.4)'}}>@{f.username}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="px-5 py-4">
                  <div className="text-xs font-bold mb-3" style={{color:'rgba(255,255,255,.4)',textTransform:'uppercase',letterSpacing:'.1em'}}>
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
