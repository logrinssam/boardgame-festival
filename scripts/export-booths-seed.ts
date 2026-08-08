import fs from 'node:fs';
import path from 'node:path';
import { BOOTHS } from '../packages/shared/src/data/boothData.ts';

const out = BOOTHS.map((booth) => ({
  id: booth.id,
  number: booth.number,
  name: booth.name,
  subtitle: booth.subtitle,
  experienceGroup: booth.experienceGroup,
  boothType: booth.boothType,
  description: booth.description,
  location: booth.location,
  target: booth.target,
  groupLabel: booth.groupLabel ?? null,
  durationMinutes: booth.durationMinutes,
  accentColor: booth.accentColor,
  capacity: booth.capacity,
  waitlistCapacity: booth.waitlistCapacity,
  status: booth.status,
  staffingType: booth.staffingType,
  activities: booth.activities ?? [],
  operationMode: booth.operationMode,
  accessCodeConfigured: booth.accessCodeConfigured,
  accessCode: booth.accessCode,
  slots: booth.slots.map((slot) => ({
    id: slot.id,
    scheduleSlotId: slot.scheduleSlotId,
    startTime: slot.startTime,
    endTime: slot.endTime,
    period: slot.period,
  })),
}));

const target = path.resolve(import.meta.dirname, 'booths-seed.json');
fs.writeFileSync(target, JSON.stringify(out, null, 2), 'utf8');
console.log(`Wrote ${out.length} booths to ${target}`);
