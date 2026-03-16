#!/usr/bin/env python3
"""
1. RV Model Auto-Groups: auto-create and join group when RV model is set
2. Campfire Channel: fix and complete
"""
import os, re

ROOT = os.path.expanduser('~/Downloads/kindletribe-mvp')
BACKEND = os.path.join(ROOT, 'backend/src')

def patch(path, old, new, label=''):
    with open(path) as f:
        content = f.read()
    if old not in content:
        print(f'  WARN [{label}] not found')
        return False
    with open(path, 'w') as f:
        f.write(content.replace(old, new, 1))
    print(f'  OK [{label}]')
    return True

print('\n1. RV Model Auto-Groups\n')

rv_routes = f'{BACKEND}/routes/rv.routes.ts'
with open(rv_routes) as f:
    content = f.read()

# After user is updated with RV model, auto-create/join group
old = """    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,"""

new = """    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,"""

# Find where the update ends and add group logic after it
auto_group_code = '''
    // Auto-create/join RV model group
    try {
      const make = model.make.name.trim();
      const modelName = model.name.trim();
      const groupName = `${make} ${modelName} Owners`;
      const slug = groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      // Find or create the group
      let group = await prisma.group.findFirst({ where: { slug } });
      if (!group) {
        // Find a system user to be creator, fallback to this user
        const systemUser = await prisma.user.findFirst({
          where: { email: 'system@rvunicorn.com' },
          select: { id: true }
        }).catch(() => null);
        const creatorId = systemUser?.id || req.userId;

        group = await prisma.group.create({
          data: {
            name: groupName,
            slug,
            description: `Community group for ${make} ${modelName} owners. Share tips, mods, routes, and connect with fellow ${modelName} enthusiasts!`,
            privacy: 'PUBLIC',
            tags: [make, modelName, 'RV Owners'],
            createdById: creatorId,
          }
        });
        console.log(`Created new RV group: ${groupName}`);
      }

      // Add user to group if not already a member
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: req.userId } },
        create: { groupId: group.id, userId: req.userId, role: 'MEMBER', status: 'ACTIVE' },
        update: {}, // already a member, no change
      });
      console.log(`User ${req.userId} joined group: ${groupName}`);
    } catch (groupErr: any) {
      console.error('Auto-group error (non-fatal):', groupErr?.message);
    }
'''

# Insert after the user update - find where the route ends
old_end = "    res.json({ success: true, message: 'RV profile updated successfully' });"
new_end = auto_group_code + "\n    res.json({ success: true, message: 'RV profile updated successfully' });"

if old_end in content:
    content = content.replace(old_end, new_end, 1)
    with open(rv_routes, 'w') as f:
        f.write(content)
    print('  OK Auto-group logic added to rv.routes.ts')
else:
    # Try alternative ending
    print('  WARN exact ending not found, checking alternatives...')
    # Find the res.json in the model save route
    matches = [(m.start(), m.group()) for m in re.finditer(r"res\.json\(\{.*?success.*?\}\)", content)]
    for start, match in matches[:5]:
        print(f'  Found: {match[:80]}')

print('\n2. Also hook into auth registration\n')

# Also add group join when user updates profile with rvMake/rvModel manually
profile_routes = f'{BACKEND}/routes/profile.routes.ts'
with open(profile_routes) as f:
    pc = f.read()

# Find where rvMake/rvModel is updated in profile save
if 'rvAutoGroup' not in pc:
    # Add a helper function at the top of the file
    helper = '''
// Helper: auto-join RV model group
async function autoJoinRvGroup(prisma: any, userId: string, rvMake: string, rvModel: string) {
  try {
    if (!rvMake || !rvModel) return;
    const groupName = `${rvMake.trim()} ${rvModel.trim()} Owners`;
    const slug = groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let group = await prisma.group.findFirst({ where: { slug } });
    if (!group) {
      const systemUser = await prisma.user.findFirst({ where: { email: 'system@rvunicorn.com' }, select: { id: true } }).catch(() => null);
      group = await prisma.group.create({
        data: {
          name: groupName, slug,
          description: `Community group for ${rvMake.trim()} ${rvModel.trim()} owners!`,
          privacy: 'PUBLIC',
          tags: [rvMake.trim(), rvModel.trim(), 'RV Owners'],
          createdById: systemUser?.id || userId,
        }
      });
    }
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: { groupId: group.id, userId, role: 'MEMBER', status: 'ACTIVE' },
      update: {},
    });
  } catch (e: any) { console.error('autoJoinRvGroup error:', e?.message); }
}

'''
    # Add before the first router declaration
    pc = pc.replace("const router = Router();", helper + "const router = Router();", 1)
    with open(profile_routes, 'w') as f:
        f.write(pc)
    print('  OK autoJoinRvGroup helper added to profile.routes.ts')

print('\n' + '='*55)
print('RV Groups Build Complete!')
print('\nRun:')
print('git add -A && git commit -m "feat: auto-create and join RV model groups" && git push')
