import { mergeRemoteDay, readDayRegs } from "@/lib/diet/day-log";
import { mergeRemoteProfile, readProfileRegs } from "@/lib/diet/profile-notes";
import { applyRemotePlan, readSharedPlan } from "@/lib/diet/storage";
import { dateKey } from "@/lib/diet/logic";
import { getDeviceId, getDeviceName } from "@/lib/device";

import { noticeRecords, putNotice } from "./notices";
import type { LocalData } from "./sync";

/** Lo compartible de ESTE teléfono, leído y escrito por los mismos módulos de siempre. */
export function browserLocal(): LocalData {
  return {
    deviceId: getDeviceId,
    deviceName: getDeviceName,
    days: readDayRegs,
    mergeDay: mergeRemoteDay,
    profile: readProfileRegs,
    mergeProfile: mergeRemoteProfile,
    plan: readSharedPlan,
    applyPlan: applyRemotePlan,
    notices: () => noticeRecords(dateKey(new Date())),
    mergeNotice: (id, notice) => putNotice(id, notice, dateKey(new Date())),
  };
}
