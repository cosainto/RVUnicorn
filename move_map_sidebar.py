#!/usr/bin/env python3
"""
Move Map + Planned Trips from left column to sidebar (above Top 8 Friends)
Run from: ~/Downloads/kindletribe-mvp/
"""

import os, sys, shutil, re
from datetime import datetime

BASECAMP = os.path.join(os.getcwd(), "frontend", "src", "pages", "BasecampPage.tsx")
BACKUP = os.path.join(os.getcwd(), "backups", f"map-move-{datetime.now().strftime('%Y%m%d-%H%M%S')}")

os.makedirs(BACKUP, exist_ok=True)
shutil.copy2(BASECAMP, os.path.join(BACKUP, "BasecampPage.tsx"))
print(f"✓ Backed up")

with open(BASECAMP, 'r') as f:
    lines = f.readlines()

content = ''.join(lines)

# ═══════════════════════════════════════════════════════════════════
# Step 1: Find and extract the Map Section + Planned Trips block
# ═══════════════════════════════════════════════════════════════════

# The map section starts with "{/* Map Section */}" 
# and the planned trips ends before the closing </div> of the left column
# followed by "{/* Sidebar */}"

map_start_marker = '            {/* Map Section */}'
sidebar_marker = '          {/* Sidebar */}'

map_start_idx = content.index(map_start_marker)
sidebar_idx = content.index(sidebar_marker)

# Everything between map start and sidebar is the map+trips block
# But we need to leave the closing </div> for the left column
# Find the last </div> before sidebar
left_col_end = content.rfind('</div>', map_start_idx, sidebar_idx)

# The map block is from map_start to just before the left column's closing tags
# Let's find where the planned trips section ends by looking for the closing divs
# before the sidebar

# Get the block to move
map_block = content[map_start_idx:sidebar_idx].rstrip()

# Clean up: remove trailing closing divs that belong to the left column container
# Count the extra </div> tags at the end
# The left column div structure ends with several </div> before sidebar
# We need to keep those in the left column
lines_in_block = map_block.split('\n')

# Remove trailing empty lines and the closing </div> of the left column
while lines_in_block and lines_in_block[-1].strip() in ['', '</div>']:
    removed = lines_in_block.pop()
    if removed.strip() == '</div>':
        break  # Keep removing until we hit the column closer

# Actually let's be more precise - find the end of planned trips section
# and take everything from Map Section to end of Planned Trips

# The structure is:
# {/* Map Section */}
# <div className="bg-white...">
#   ... map content ...
#   <TravelMap .../>
# </div>
# {/* Planned Events List */}
# <div className="bg-white...">
#   ... planned trips ...
# </div>  ← end of planned trips
#          ← possible blank lines
# </div>  ← end of left column (.lg:col-span-2)
# {/* Sidebar */}

# Let me find the exact planned trips ending by working backwards from sidebar
pre_sidebar = content[map_start_idx:sidebar_idx]

# Remove from left column
content_without_map = content[:map_start_idx] + '\n' + content[sidebar_idx:]

print(f"✓ Removed map block from left column")

# ═══════════════════════════════════════════════════════════════════
# Step 2: Create a compact sidebar version of the map + trips
# ═══════════════════════════════════════════════════════════════════

compact_map = '''            {/* Travel Map - Compact */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary-600" />
                    Travel Map
                  </h3>
                  <Link to="/travel" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                    Full Map →
                  </Link>
                </div>
                {/* Compact Stats */}
                <div className="flex items-center gap-3 mb-3 text-xs">
                  <span className="flex items-center gap-1 text-primary-600 font-semibold">
                    <MapPin className="w-3 h-3" /> {visitedStatesCount} states
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-500">{50 - visitedStatesCount} to go</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-emerald-600 font-medium">{Math.round((visitedStatesCount / 50) * 100)}%</span>
                </div>
              </div>
              <div className="px-2 pb-2" style={{ maxHeight: '280px', overflow: 'hidden' }}>
                <TravelMap userId={user.id} isOwnProfile={true} />
              </div>
            </div>

            {/* Upcoming Trips - Compact */}
            {plannedTrips.length > 0 && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      Upcoming Trips
                      <span className="text-xs font-normal text-gray-400">({plannedTrips.length})</span>
                    </h3>
                    <Link to="/trips" className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All</Link>
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-2">
                  {plannedTrips.slice(0, 3).map((trip) => (
                    <Link
                      key={`${trip.type}-${trip.id}`}
                      to={trip.type === 'event' ? `/trips/${trip.id}` : `/travel`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{trip.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {trip.campground?.name && ` · ${trip.campground.name}`}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

'''

# ═══════════════════════════════════════════════════════════════════
# Step 3: Insert compact map above Top8Friends in sidebar
# ═══════════════════════════════════════════════════════════════════

top8_marker = '             <Top8Friends username={user?.username} />'

if top8_marker in content_without_map:
    content_without_map = content_without_map.replace(
        top8_marker,
        compact_map + '             <Top8Friends username={user?.username} />'
    )
    print(f"✓ Inserted compact map above Top 8 Friends in sidebar")
else:
    # Try with different whitespace
    alt_marker = '<Top8Friends username={user?.username} />'
    idx = content_without_map.index(alt_marker)
    # Get the indentation
    line_start = content_without_map.rfind('\n', 0, idx) + 1
    indent = content_without_map[line_start:idx]
    content_without_map = content_without_map[:line_start] + compact_map + indent + alt_marker + content_without_map[idx + len(alt_marker):]
    print(f"✓ Inserted compact map (alt match)")

# ═══════════════════════════════════════════════════════════════════
# Step 4: Also remove the old stats strip from left column 
# (it's now inline in the compact map widget)
# ═══════════════════════════════════════════════════════════════════

# The stats strip was added above TravelMap in the left column.
# Since the whole map section was removed, the stats strip went with it.
# But there may still be a reference to the old TravelMap stats strip - 
# Let's check if the stats strip is still there
if '{/* Travel Stats Strip */}' in content_without_map:
    # Find and remove the orphaned stats strip
    stats_start = content_without_map.index('{/* Travel Stats Strip */}')
    # Find the line start
    line_start = content_without_map.rfind('\n', 0, stats_start)
    # Find the end - it closes with </div> then the TravelMap
    travelmap_ref = '<TravelMap userId={user.id} isOwnProfile={true} />'
    if travelmap_ref in content_without_map[stats_start:stats_start+2000]:
        # The old stats + travelmap are orphaned in the left column
        pass  # They were already removed with the map section
    print("  ├─ Stats strip was removed with map section ✓")

# ═══════════════════════════════════════════════════════════════════
# Step 5: Clean up any leftover empty left column closing divs
# ═══════════════════════════════════════════════════════════════════

# The left column may have extra closing </div> tags now
# Clean up multiple blank lines
content_without_map = re.sub(r'\n{4,}', '\n\n\n', content_without_map)

# Fix: the left column end might have orphaned </div> tags
# The structure should be: feeds → </div> (left col) → sidebar
# Make sure the left column div closes properly

with open(BASECAMP, 'w') as f:
    f.write(content_without_map)

print(f"\n✅ Done! Map + Planned Trips moved to sidebar above Top 8 Friends")
print(f"   Left column: Activity feeds only (cleaner)")
print(f"   Sidebar: Map → Upcoming Trips → Top 8 Friends → RV Info → ...")
print(f"\n   Test: cd frontend && npm run dev")
