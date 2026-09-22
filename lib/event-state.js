export function resolveEventState(event) {
  const now = Date.now();
  const opens = event.registration_opens_at ? new Date(event.registration_opens_at).getTime() : null;
  const closes = event.registration_closes_at ? new Date(event.registration_closes_at).getTime() : null;
  const maintenanceUntil = event.maintenance_until ? new Date(event.maintenance_until).getTime() : null;

  if (event.registration_status === 'maintenance') {
    if (!maintenanceUntil || now < maintenanceUntil) {
      return { status: 'maintenance', isOpen: false, message: event.maintenance_message, maintenanceUntil: event.maintenance_until };
    }
    return { status: 'open', isOpen: true, message: '' };
  }
  if (event.registration_status === 'closed') return { status: 'closed', isOpen: false, message: event.closed_message };
  if (event.registration_status === 'scheduled') {
    if (opens && now < opens) return { status: 'not_open', isOpen: false, message: event.not_open_message, opensAt: event.registration_opens_at };
    if (closes && now > closes) return { status: 'closed', isOpen: false, message: event.closed_message, closesAt: event.registration_closes_at };
  }
  return { status: 'open', isOpen: true, message: '' };
}
