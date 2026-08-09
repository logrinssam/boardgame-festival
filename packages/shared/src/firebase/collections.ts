/**
 * Firestore 컬렉션 초안 (문서 ID 예시 포함)
 *
 * booths/{boothId}
 *   - number, name, experienceGroup, capacity, waitlistCapacity, status
 *   - slots: [{ id, scheduleSlotId, startTime, endTime, confirmedCount, waitlistCount, bookingOpen }]
 *   - accessCodeHash (평문 금지), 클라이언트 공개 필드와 분리 권장
 *
 * reservations/{reservationId}
 *   - reservationCode, boothId, slotId, scheduleSlotId
 *   - participantName, phoneHash, phoneLast4, gradeOrAge
 *   - status, waitlistOrder, createdAt, updatedAt, updatedBy, previousStatus
 *
 * staffAssignments/{uid}  // Auth uid와 동일
 *   - name, role, experienceGroup, assignedBoothIds[], isActive, loginId?
 *
 * operationLogs/{logId}
 *   - reservationId, boothId, slotId, action, previousStatus, newStatus
 *   - operatorId, operatorName, participantName, createdAt
 */

export const FIRESTORE_COLLECTIONS = {
  booths: 'booths',
  reservations: 'reservations',
  walkInRegistrations: 'walkInRegistrations',
  staffAssignments: 'staffAssignments',
  operationLogs: 'operationLogs',
} as const;
