#!/usr/bin/env python3
"""
RVUnicorn Basecamp UX Enhancement
===================================
Run from: ~/Downloads/kindletribe-mvp/

Changes:
  1. Collapse composer into slim bar (expands on click)
  2. Replace Quick Links with smart contextual action cards
  3. Add travel stats strip above the map
  4. Move activity feeds above the map (what's new first, journey second)
"""

import os, sys, shutil
from datetime import datetime

PROJECT_ROOT = os.getcwd()
BASECAMP_PATH = os.path.join(PROJECT_ROOT, "frontend", "src", "pages", "BasecampPage.tsx")
BACKUP_DIR = os.path.join(PROJECT_ROOT, "backups", f"basecamp-ux-{datetime.now().strftime('%Y%m%d-%H%M%S')}")

class C:
    GREEN = '\033[92m'; YELLOW = '\033[93m'; RED = '\033[91m'; BLUE = '\033[94m'; BOLD = '\033[1m'; END = '\033[0m'

def log(msg, color=C.GREEN): print(f"{color}{C.BOLD}▸{C.END} {msg}")
def header(msg): print(f"\n{C.BLUE}{C.BOLD}{'═'*60}\n  {msg}\n{'═'*60}{C.END}\n")

def backup():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    shutil.copy2(BASECAMP_PATH, os.path.join(BACKUP_DIR, "BasecampPage.tsx"))
    log(f"Backed up to {os.path.relpath(BACKUP_DIR, PROJECT_ROOT)}/")

def read_file():
    with open(BASECAMP_PATH, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(content):
    with open(BASECAMP_PATH, 'w', encoding='utf-8') as f:
        f.write(content)

# ═══════════════════════════════════════════════════════════════════════════════
# EDIT 1: Collapse the composer into a slim expandable bar
# ═══════════════════════════════════════════════════════════════════════════════

def edit_1_collapse_composer(content):
    """Replace full EnhancedStatusBar with a slim 'What's on your mind?' bar."""

    old_block = '''        {/* User Status */}
        {userProfile && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-8">
            <EnhancedStatusBar 
              user={user}
              profile={userProfile}
              onUpdate={loadRVInfo}
              onPost={loadFeed}
            />
          </div>
        )}'''

    new_block = '''        {/* User Status - Collapsed Composer */}
        {userProfile && (
          <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
            {!composerExpanded ? (
              <button
                onClick={() => setComposerExpanded(true)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="text-gray-400 text-sm flex-1">What\'s on your mind, {user?.firstName || 'camper'}?</span>
                <div className="flex items-center gap-2 text-gray-300">
                  <Camera className="w-4 h-4" />
                  <MapPin className="w-4 h-4" />
                  <Smile className="w-4 h-4" />
                </div>
              </button>
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">Create a post</span>
                  <button onClick={() => setComposerExpanded(false)} className="text-gray-400 hover:text-gray-600 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <EnhancedStatusBar 
                  user={user}
                  profile={userProfile}
                  onUpdate={loadRVInfo}
                  onPost={() => { loadFeed(); setComposerExpanded(false); }}
                />
              </div>
            )}
          </div>
        )}'''

    if old_block in content:
        content = content.replace(old_block, new_block)
        log("✓ Collapsed composer into slim bar")
    else:
        log("⚠ Could not find exact composer block — trying flexible match", C.YELLOW)
        # Try a more flexible match
        if 'EnhancedStatusBar' in content and '<div className="bg-white rounded-lg shadow-md p-4 mb-8">' in content:
            content = content.replace(
                '<div className="bg-white rounded-lg shadow-md p-4 mb-8">\n            <EnhancedStatusBar',
                '<div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">\n            {!composerExpanded ? (\n              <button onClick={() => setComposerExpanded(true)} className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left">\n                {user?.profilePicture ? <img src={user.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200" /> : <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center"><User className="w-4 h-4 text-white" /></div>}\n                <span className="text-gray-400 text-sm flex-1">What\'s on your mind?</span>\n                <div className="flex items-center gap-2 text-gray-300"><Camera className="w-4 h-4" /><MapPin className="w-4 h-4" /></div>\n              </button>\n            ) : (\n              <div className="p-4"><EnhancedStatusBar'
            )
            log("✓ Applied flexible composer collapse")

    # Add composerExpanded state if not present
    if 'composerExpanded' not in content:
        # Find a good place to add state - after other useState declarations
        content = content.replace(
            'const [editingLinks, setEditingLinks] = useState(false);',
            'const [editingLinks, setEditingLinks] = useState(false);\n  const [composerExpanded, setComposerExpanded] = useState(false);'
        )
        log("  ├─ Added composerExpanded state")

    # Make sure Camera and Smile are imported
    if 'Smile' not in content.split('from \'lucide-react\'')[0]:
        # Add Smile to lucide imports
        content = content.replace(
            "} from 'lucide-react';",
            ", Smile} from 'lucide-react';",
            1  # Only first occurrence
        )
        # Clean up double comma if needed
        content = content.replace(', , Smile', ', Smile')
        content = content.replace(',, Smile', ', Smile')
        log("  ├─ Added Smile to imports")

    if 'Camera' not in content.split('from \'lucide-react\'')[0]:
        content = content.replace(
            "} from 'lucide-react';",
            ", Camera} from 'lucide-react';",
            1
        )
        content = content.replace(', , Camera', ', Camera')
        content = content.replace(',, Camera', ', Camera')
        log("  ├─ Added Camera to imports")

    return content


# ═══════════════════════════════════════════════════════════════════════════════
# EDIT 2: Replace Quick Links with Smart Contextual Cards
# ═══════════════════════════════════════════════════════════════════════════════

def edit_2_smart_cards(content):
    """Replace the Quick Links grid with contextual smart action cards."""

    # Find the Quick Links block
    ql_start_marker = '{/* Customizable Quick Links */}'
    ql_end_marker = '{/* Creator Mode Section */}'

    if ql_start_marker in content and ql_end_marker in content:
        start_idx = content.index(ql_start_marker)
        end_idx = content.index(ql_end_marker)

        # Find the start of the containing div (go back to find the opening div)
        # The quick links block starts with: <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        # We need to find that div's start
        line_start = content.rfind('\n', 0, start_idx)
        if line_start == -1:
            line_start = start_idx

        old_block = content[line_start:end_idx]

        new_block = '''
        {/* Smart Action Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {/* Upcoming Trip Card */}
          {nextEvent ? (
            <Link to={`/trips/${nextEvent.id}`} className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 hover:shadow-md transition group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-100 rounded-lg"><Calendar className="w-4 h-4 text-blue-600" /></div>
                <span className="text-xs font-medium text-blue-600">Next Trip</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm truncate">{nextEvent.title || nextEvent.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{countdown.days}d {countdown.hours}h away</p>
            </Link>
          ) : (
            <Link to="/trips" className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 border-dashed rounded-xl p-4 hover:shadow-md transition group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-100 rounded-lg"><CalendarPlus className="w-4 h-4 text-blue-600" /></div>
                <span className="text-xs font-medium text-blue-600">No Trips</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">Plan your next adventure</p>
              <p className="text-xs text-blue-500 mt-0.5 group-hover:underline">Get started →</p>
            </Link>
          )}

          {/* Unread Messages Card */}
          <Link to="/messages" className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-4 hover:shadow-md transition group">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-purple-100 rounded-lg"><MessageSquare className="w-4 h-4 text-purple-600" /></div>
              <span className="text-xs font-medium text-purple-600">Messages</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">Check conversations</p>
            <p className="text-xs text-purple-500 mt-0.5 group-hover:underline">Open inbox →</p>
          </Link>

          {/* RV Health Card */}
          <Link to="/travel?tab=rv-log" className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-4 hover:shadow-md transition group">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-amber-100 rounded-lg"><Truck className="w-4 h-4 text-amber-600" /></div>
              <span className="text-xs font-medium text-amber-600">RV Health</span>
            </div>
            {maintenanceStats?.overdue > 0 ? (
              <>
                <p className="font-semibold text-amber-700 text-sm">{maintenanceStats.overdue} items overdue</p>
                <p className="text-xs text-amber-500 mt-0.5">Needs attention ⚠️</p>
              </>
            ) : maintenanceStats?.upcoming > 0 ? (
              <>
                <p className="font-semibold text-gray-900 text-sm">{maintenanceStats.upcoming} upcoming</p>
                <p className="text-xs text-amber-500 mt-0.5 group-hover:underline">View log →</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-gray-900 text-sm">All good ✓</p>
                <p className="text-xs text-green-500 mt-0.5">No maintenance due</p>
              </>
            )}
          </Link>

          {/* Explore Card */}
          <Link to="/campgrounds" className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4 hover:shadow-md transition group">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-green-100 rounded-lg"><Tent className="w-4 h-4 text-green-600" /></div>
              <span className="text-xs font-medium text-green-600">Explore</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">Find campgrounds</p>
            <p className="text-xs text-green-500 mt-0.5 group-hover:underline">Browse 31,000+ →</p>
          </Link>
        </div>

        '''

        content = content[:line_start] + new_block + content[end_idx:]
        log("✓ Replaced Quick Links with smart contextual cards")
    else:
        log("⚠ Could not find Quick Links markers", C.YELLOW)
        if ql_start_marker not in content:
            log(f"  Missing: {ql_start_marker}", C.RED)
        if ql_end_marker not in content:
            log(f"  Missing: {ql_end_marker}", C.RED)

    return content


# ═══════════════════════════════════════════════════════════════════════════════
# EDIT 3: Add Travel Stats Strip above the Map
# ═══════════════════════════════════════════════════════════════════════════════

def edit_3_travel_stats(content):
    """Add a stats strip above the travel map."""

    map_header = '''              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-primary-600" />
                  Your Travel Map
                </h2>'''

    new_header_with_stats = '''              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-primary-600" />
                  Your Travel Map
                </h2>'''

    # Find the TravelMap section and add stats strip before it
    map_section_marker = '<TravelMap userId={user.id} isOwnProfile={true} />'

    if map_section_marker in content:
        stats_strip = '''
              {/* Travel Stats Strip */}
              <div className="flex items-center gap-4 mb-4 py-3 px-4 bg-gradient-to-r from-primary-50 via-blue-50 to-indigo-50 rounded-lg border border-primary-100">
                <div className="flex items-center gap-6 flex-1 overflow-x-auto">
                  {stateVisits && (
                    <>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-primary-600" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-primary-700 leading-none">{stateVisits.length || 0}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">States</p>
                        </div>
                      </div>
                      <div className="w-px h-8 bg-gray-200 flex-shrink-0" />
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <Tent className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-emerald-700 leading-none">{50 - (stateVisits.length || 0)}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">To Go</p>
                        </div>
                      </div>
                      <div className="w-px h-8 bg-gray-200 flex-shrink-0" />
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-amber-700 leading-none">{plannedTrips.length}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Trips Planned</p>
                        </div>
                      </div>
                      <div className="w-px h-8 bg-gray-200 flex-shrink-0" />
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <Award className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-purple-700 leading-none">{Math.round(((stateVisits.length || 0) / 50) * 100)}%</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Complete</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <Link to="/travel" className="text-xs text-primary-600 hover:text-primary-700 font-medium flex-shrink-0 hidden sm:block">
                  Full Map →
                </Link>
              </div>
'''
        content = content.replace(
            map_section_marker,
            stats_strip + '              ' + map_section_marker
        )
        log("✓ Added travel stats strip above map")
    else:
        log("⚠ Could not find TravelMap marker", C.YELLOW)

    # Make sure Award is imported (for the % complete icon)
    if "'Award'" not in content.split("from 'lucide-react'")[0] and 'Award' not in content.split("from 'lucide-react'")[0]:
        # Check if Award is already imported
        import_section = content[:content.index("from 'lucide-react'")]
        if 'Award' not in import_section:
            content = content.replace(
                "} from 'lucide-react';",
                ", Award} from 'lucide-react';",
                1
            )
            content = content.replace(', , Award', ', Award')
            content = content.replace(',, Award', ', Award')
            log("  ├─ Added Award to imports")

    return content


# ═══════════════════════════════════════════════════════════════════════════════
# EDIT 4: Move Activity Feeds Above the Map
# ═══════════════════════════════════════════════════════════════════════════════

def edit_4_reorder_feeds(content):
    """Move CreatorFeed + SocialFeed above the Map + Planned Trips."""

    # Current order in left column:
    #   Map Section → Planned Events → CreatorFeed → SocialFeed
    # New order:
    #   CreatorFeed → SocialFeed → Map Section → Planned Events

    # The feeds are at lines 2053-2055:
    #   <CreatorFeed limit={6} showHeader={true} />
    #   <SocialFeed username={user?.username || ""} isOwnProfile={true} includePacking={true} />

    # Step 1: Remove the feeds from their current position
    feeds_block = '''            {/* Activity Wall */}
            {/* Creator Videos from people you follow */}
            <CreatorFeed limit={6} showHeader={true} />

            <SocialFeed username={user?.username || ""} isOwnProfile={true} includePacking={true} />'''

    if feeds_block in content:
        content = content.replace(feeds_block, '')
        log("  ├─ Removed feeds from old position")
    else:
        # Try variations
        alt1 = '<CreatorFeed limit={6} showHeader={true} />\n\n            <SocialFeed username={user?.username || ""} isOwnProfile={true} includePacking={true} />'
        if alt1 in content:
            content = content.replace(alt1, '')
            log("  ├─ Removed feeds (alt match)")
        else:
            log("  ⚠ Could not find feeds block to move", C.YELLOW)
            return content

    # Step 2: Insert feeds BEFORE the map section
    map_marker = '''            {/* Map Section */}
            <div className="bg-white rounded-lg shadow-md p-6">'''

    if map_marker in content:
        feeds_new = '''            {/* What\'s New — Activity Feeds (moved above map) */}
            <CreatorFeed limit={6} showHeader={true} />
            <SocialFeed username={user?.username || ""} isOwnProfile={true} includePacking={true} />

            {/* Map Section */}
            <div className="bg-white rounded-lg shadow-md p-6">'''

        content = content.replace(map_marker, feeds_new)
        log("✓ Moved activity feeds above the map")
    else:
        log("  ⚠ Could not find map marker for insertion", C.YELLOW)
        # Fallback: try to find just the map div
        alt_map = '<div className="bg-white rounded-lg shadow-md p-6">\n              <div className="flex items-center justify-between mb-4">\n                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">\n                  <MapPin className="w-6 h-6 text-primary-600" />\n                  Your Travel Map'
        if alt_map in content:
            content = content.replace(alt_map,
                '            <CreatorFeed limit={6} showHeader={true} />\n            <SocialFeed username={user?.username || ""} isOwnProfile={true} includePacking={true} />\n\n' + alt_map)
            log("✓ Moved feeds (fallback match)")

    return content


# ═══════════════════════════════════════════════════════════════════════════════
# Also remove the duplicate Quick Actions from sidebar (they're now smart cards)
# ═══════════════════════════════════════════════════════════════════════════════

def edit_5_remove_sidebar_quick_actions(content):
    """Remove the sidebar Quick Actions block since smart cards replace them."""

    qa_block = '''            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  to="/trips"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <CalendarPlus className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-gray-700">Plan a Trip</span>
                </Link>
                <Link
                  to="/campgrounds"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <Tent className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-700">Find Campgrounds</span>
                </Link>
                <Link
                  to="/feed"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-gray-700">View Discussions</span>
                </Link>
                <Link
                  to="/trips"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <CalendarPlus className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm text-gray-700">Browse Trips</span>
                </Link>
              </div>
            </div>'''

    if qa_block in content:
        content = content.replace(qa_block, '')
        log("✓ Removed duplicate sidebar Quick Actions")
    else:
        log("  ⚠ Sidebar Quick Actions block not found (may differ)", C.YELLOW)

    return content


# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    header("🏕️  RVUnicorn Basecamp UX Enhancement")

    if not os.path.exists(BASECAMP_PATH):
        print(f"{C.RED}ERROR: BasecampPage.tsx not found. Run from ~/Downloads/kindletribe-mvp/{C.END}")
        sys.exit(1)

    backup()
    content = read_file()
    original_len = len(content)

    header("1️⃣  Collapsing Composer into Slim Bar")
    content = edit_1_collapse_composer(content)

    header("2️⃣  Replacing Quick Links with Smart Cards")
    content = edit_2_smart_cards(content)

    header("3️⃣  Adding Travel Stats Strip")
    content = edit_3_travel_stats(content)

    header("4️⃣  Moving Activity Feeds Above Map")
    content = edit_4_reorder_feeds(content)

    header("5️⃣  Cleaning Up Duplicate Sidebar Actions")
    content = edit_5_remove_sidebar_quick_actions(content)

    write_file(content)

    header("✅ Basecamp UX Enhancement Complete!")
    print(f"""
{C.GREEN}{C.BOLD}Changes made:{C.END}

  1. Composer → slim "What's on your mind?" bar (expands on click)
  2. Quick Links → smart contextual cards (next trip, messages, RV health, explore)
  3. Travel stats strip → "12 States | 38 To Go | 3 Trips Planned | 24% Complete"
  4. Activity feeds moved ABOVE the map (what's new first)
  5. Removed duplicate sidebar Quick Actions

{C.BOLD}File:{C.END} {os.path.relpath(BASECAMP_PATH, PROJECT_ROOT)}
{C.BOLD}Size:{C.END} {original_len:,} → {len(content):,} chars
{C.GREEN}Backup:{C.END} {os.path.relpath(BACKUP_DIR, PROJECT_ROOT)}/

{C.YELLOW}Test:{C.END}
  cd frontend && npm run dev
  Visit http://localhost:5173/basecamp
""")

if __name__ == "__main__":
    main()
